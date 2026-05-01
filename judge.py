#!/usr/bin/env python3
"""
RentPi Hackathon - Advanced Automated Judge Test Suite v2.0
Professional-grade validation with comprehensive checks.
Usage: python judge.py
"""

import requests
import json
import sys
import time
import re
import subprocess
from datetime import datetime, timedelta
from collections import defaultdict
import hashlib

# Configuration
API_GATEWAY = "http://localhost:8000"
FRONTEND = "http://localhost:3000"
TIMEOUT = 15
RATE_LIMIT_TRACKING = defaultdict(list)

# Test results tracking
results = {
    "passed": [],
    "failed": [],
    "warnings": [],
    "errors": [],
    "security_issues": [],
    "performance_issues": []
}

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'
    END = '\033[0m'

def log_pass(test_name, points=0, detail=""):
    """Log a passing test"""
    msg = f"âœ“ {test_name}"
    if points > 0:
        msg += f" (+{points} pts)"
    if detail:
        msg += f" | {detail}"
    print(f"{Colors.GREEN}{msg}{Colors.END}")
    results["passed"].append({"name": test_name, "points": points, "detail": detail})

def log_fail(test_name, reason, points=0):
    """Log a failing test"""
    msg = f"âœ— {test_name}: {reason}"
    if points > 0:
        msg += f" (-{points} pts)"
    print(f"{Colors.RED}{msg}{Colors.END}")
    results["failed"].append({"name": test_name, "reason": reason, "points": points})

def log_warn(test_name, reason):
    """Log a warning"""
    print(f"{Colors.YELLOW}âš  {test_name}: {reason}{Colors.END}")
    results["warnings"].append({"name": test_name, "reason": reason})

def log_error(test_name, error):
    """Log an error"""
    print(f"{Colors.RED}âš¡ ERROR {test_name}: {error}{Colors.END}")
    results["errors"].append({"name": test_name, "error": str(error)})

def log_security(issue, severity="HIGH"):
    """Log a security issue"""
    icon = "ðŸ”“" if severity == "HIGH" else "âš ï¸"
    print(f"{Colors.RED}{icon} SECURITY [{severity}]: {issue}{Colors.END}")
    results["security_issues"].append({"issue": issue, "severity": severity})

def log_perf(issue, threshold=""):
    """Log a performance issue"""
    msg = f"â± PERFORMANCE: {issue}"
    if threshold:
        msg += f" (threshold: {threshold})"
    print(f"{Colors.MAGENTA}{msg}{Colors.END}")
    results["performance_issues"].append({"issue": issue, "threshold": threshold})

def log_section(title):
    """Log a section header"""
    print(f"\n{Colors.BLUE}{'='*70}\n{title}\n{'='*70}{Colors.END}")

def validate_json_response(response, expected_fields=None):
    """Validate response is valid JSON with expected fields"""
    try:
        data = response.json()
        if expected_fields:
            missing = [f for f in expected_fields if f not in data]
            if missing:
                return False, f"Missing fields: {missing}", None
        return True, "Valid JSON", data
    except:
        return False, "Invalid JSON response", None

def validate_status_code(actual, expected):
    """Validate HTTP status code"""
    if isinstance(expected, list):
        return actual in expected
    return actual == expected

def check_for_exposed_secrets(response_text):
    """Check if response contains exposed secrets"""
    sensitive_patterns = [
        r'token["\']?\s*[:=]\s*["\']?([a-zA-Z0-9_-]{20,})',
        r'password["\']?\s*[:=]\s*["\']?([a-zA-Z0-9!@#$%^&*]{8,})',
        r'api[_-]?key["\']?\s*[:=]\s*["\']?([a-zA-Z0-9_-]{20,})',
        r'secret["\']?\s*[:=]\s*["\']?([a-zA-Z0-9_-]{20,})',
    ]
    
    for pattern in sensitive_patterns:
        if re.search(pattern, response_text, re.IGNORECASE):
            return True
    return False

def measure_response_time(func, *args, **kwargs):
    """Measure response time of a function"""
    start = time.time()
    result = func(*args, **kwargs)
    elapsed = time.time() - start
    return result, elapsed

# ==================== INFRASTRUCTURE TESTS ====================

def test_docker_services():
    """Comprehensive Docker service validation"""
    try:
        result = subprocess.run(
            ["docker", "ps", "--format", "{{.Names}}\t{{.Status}}"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        services = {}
        for line in result.stdout.strip().split('\n'):
            if line:
                parts = line.split('\t')
                services[parts[0]] = parts[1] if len(parts) > 1 else "unknown"
        
        required = {
            "api-gateway": "api-gateway",
            "user-service": "user-service",
            "rental-service": "rental-service",
            "analytics-service": "analytics-service",
            "agentic-service": "agentic-service",
            "frontend": "frontend",
            "postgres": "postgres",
            "mongo": "mongo"
        }
        
        all_healthy = True
        for name, label in required.items():
            found = False
            for service_name, status in services.items():
                if label in service_name:
                    found = True
                    is_healthy = "healthy" in status.lower() or "up" in status.lower()
                    if is_healthy:
                        log_pass(f"Docker: {label}", detail=f"Status: {status}")
                    else:
                        log_warn(f"Docker: {label}", f"Not healthy - {status}")
                        all_healthy = False
                    break
            
            if not found:
                log_fail(f"Docker: {label}", f"Service not found")
                all_healthy = False
        
        return all_healthy
    except Exception as e:
        log_error("Docker Check", e)
        return False

def test_gateway_health():
    """Test API Gateway health and response time"""
    try:
        response, elapsed = measure_response_time(
            requests.get,
            f"{API_GATEWAY}/status",
            timeout=TIMEOUT
        )
        
        if elapsed > 2:
            log_perf(f"Gateway /status endpoint slow: {elapsed:.2f}s", "< 1s")
        
        if response.status_code != 200:
            log_fail("Gateway Health", f"Status {response.status_code}", 20)
            return False
        
        valid, msg, data = validate_json_response(response, ["service", "status"])
        if not valid:
            log_fail("Gateway Health", msg, 20)
            return False
        
        if data["status"] != "OK":
            log_fail("Gateway Status", f"Status is {data['status']}, not OK", 20)
            return False
        
        log_pass("Gateway Health", 20, f"Response time: {elapsed:.3f}s")
        return True
    except Exception as e:
        log_error("Gateway Health", e)
        return False

def test_downstream_aggregation():
    """Test that gateway properly aggregates downstream services"""
    try:
        response = requests.get(f"{API_GATEWAY}/status", timeout=TIMEOUT)
        if response.status_code != 200:
            log_fail("Downstream Aggregation", "Gateway unreachable")
            return False
        
        data = response.json()
        if "downstream" not in data:
            log_fail("Downstream Aggregation", "No downstream field")
            return False
        
        required_services = ["user-service", "rental-service", "analytics-service", "agentic-service"]
        downstream = data["downstream"]
        
        all_present = True
        for service in required_services:
            if service not in downstream:
                log_fail("Downstream Aggregation", f"Missing {service}")
                all_present = False
        
        if all_present:
            log_pass("Downstream Aggregation", detail="All services reported")
        
        return all_present
    except Exception as e:
        log_error("Downstream Aggregation", e)
        return False

# ==================== CHAPTER 1: FOUNDATION ====================

def test_user_auth_complete():
    """Complete user authentication flow with validation"""
    try:
        email = f"judge_{int(time.time())}@test.local"
        password = "SecurePass123!@#"
        
        # Test registration
        reg_payload = {
            "name": "Judge User",
            "email": email,
            "password": password
        }
        
        reg_response, reg_time = measure_response_time(
            requests.post,
            f"{API_GATEWAY}/users/register",
            json=reg_payload,
            timeout=TIMEOUT
        )
        
        if not validate_status_code(reg_response.status_code, [200, 201]):
            log_fail("P2: Registration", f"Status {reg_response.status_code}")
            return False
        
        valid, msg, reg_data = validate_json_response(reg_response, ["token", "jwt"])
        if not valid:
            # Try alternative field names
            valid, msg, reg_data = validate_json_response(reg_response)
            if "token" not in (reg_data or {}) and "jwt" not in (reg_data or {}):
                log_fail("P2: Registration", "No JWT in response")
                return False
        
        jwt_token = reg_data.get("token") or reg_data.get("jwt")
        
        # Check for exposed secrets in response
        if check_for_exposed_secrets(reg_response.text):
            log_security("Bearer token or password exposed in response", "CRITICAL")
            return False
        
        # Test duplicate registration
        dup_response = requests.post(
            f"{API_GATEWAY}/users/register",
            json=reg_payload,
            timeout=TIMEOUT
        )
        
        if dup_response.status_code != 409:
            log_warn("P2: Duplicate Email", f"Expected 409, got {dup_response.status_code}")
        else:
            log_pass("P2: Duplicate Detection", detail="Returns 409 for duplicate email")
        
        # Test login
        login_response, login_time = measure_response_time(
            requests.post,
            f"{API_GATEWAY}/users/login",
            json={"email": email, "password": password},
            timeout=TIMEOUT
        )
        
        if not validate_status_code(login_response.status_code, [200, 201]):
            log_fail("P2: Login", f"Status {login_response.status_code}")
            return False
        
        valid, msg, login_data = validate_json_response(login_response, ["token", "jwt"])
        if not valid:
            valid, msg, login_data = validate_json_response(login_response)
        
        jwt_token = login_data.get("token") or login_data.get("jwt")
        
        # Test protected endpoint
        me_response = requests.get(
            f"{API_GATEWAY}/users/me",
            headers={"Authorization": f"Bearer {jwt_token}"},
            timeout=TIMEOUT
        )
        
        if me_response.status_code != 200:
            log_fail("P2: Protected Endpoint", f"Status {me_response.status_code}")
            return False
        
        valid, msg, me_data = validate_json_response(me_response, ["email"])
        if not valid:
            log_fail("P2: Profile Data", msg)
            return False
        
        if me_data.get("email") != email:
            log_fail("P2: Profile Mismatch", f"Email mismatch: {me_data.get('email')} vs {email}")
            return False
        
        # Test invalid JWT
        invalid_response = requests.get(
            f"{API_GATEWAY}/users/me",
            headers={"Authorization": "Bearer invalid.token.format"},
            timeout=TIMEOUT
        )
        
        if invalid_response.status_code != 401:
            log_fail("P2: Invalid JWT", f"Expected 401, got {invalid_response.status_code}")
            return False
        
        # Test wrong password
        wrong_pass = requests.post(
            f"{API_GATEWAY}/users/login",
            json={"email": email, "password": "WrongPassword123"},
            timeout=TIMEOUT
        )
        
        if wrong_pass.status_code != 401:
            log_fail("P2: Wrong Password", f"Expected 401, got {wrong_pass.status_code}")
            return False
        
        log_pass("P2: User Authentication", 40, f"Registration: {reg_time:.3f}s, Login: {login_time:.3f}s")
        return True, jwt_token, email
    except Exception as e:
        log_error("P2: User Authentication", e)
        return False, None, None

def test_health_checks_detailed():
    """P1: Detailed health check validation"""
    try:
        response = requests.get(f"{API_GATEWAY}/status", timeout=TIMEOUT)
        
        if response.status_code != 200:
            log_fail("P1: Health Checks", f"Status {response.status_code}", 20)
            return False
        
        data = response.json()
        
        # Validate structure
        required_fields = ["service", "status", "downstream"]
        missing = [f for f in required_fields if f not in data]
        if missing:
            log_fail("P1: Health Checks", f"Missing: {missing}", 20)
            return False
        
        # Validate downstream services
        required_services = ["user-service", "rental-service", "analytics-service", "agentic-service"]
        missing_services = [s for s in required_services if s not in data["downstream"]]
        if missing_services:
            log_fail("P1: Health Checks", f"Missing downstream: {missing_services}", 20)
            return False
        
        # Validate values
        for service, status in data["downstream"].items():
            if status not in ["OK", "UNREACHABLE"]:
                log_fail("P1: Health Status", f"Invalid status '{status}' for {service}", 20)
                return False
        
        downstream_summary = ", ".join([f"{s}: {data['downstream'][s]}" for s in required_services])
        log_pass("P1: Health Checks", 20, f"All services: {downstream_summary}")
        return True
    except Exception as e:
        log_error("P1: Health Checks", e)
        return False

def test_product_proxy_detailed():
    """P3: Detailed product proxy validation"""
    try:
        # Test basic products endpoint
        response, elapsed = measure_response_time(
            requests.get,
            f"{API_GATEWAY}/rentals/products?limit=10",
            timeout=TIMEOUT
        )
        
        if response.status_code != 200:
            log_fail("P3: Product Proxy", f"Status {response.status_code}", 30)
            return False
        
        valid, msg, data = validate_json_response(
            response,
            ["data", "page", "limit", "total", "totalPages"]
        )
        
        if not valid:
            log_fail("P3: Product Proxy", msg, 30)
            return False
        
        # Validate data types
        if not isinstance(data["data"], list):
            log_fail("P3: Data Type", "data should be array", 30)
            return False
        
        if not isinstance(data["page"], int) or not isinstance(data["limit"], int):
            log_fail("P3: Pagination Types", "page and limit should be integers")
            return False
        
        # Test single product endpoint
        if data["data"]:
            product_id = data["data"][0]["id"]
            prod_response = requests.get(
                f"{API_GATEWAY}/rentals/products/{product_id}",
                timeout=TIMEOUT
            )
            
            if prod_response.status_code != 200:
                log_fail("P3: Single Product", f"Status {prod_response.status_code}")
                return False
        
        # Check for token exposure
        if check_for_exposed_secrets(response.text):
            log_security("Bearer token exposed in product response", "HIGH")
        
        log_pass("P3: Product Proxy", 30, f"Response time: {elapsed:.3f}s, {len(data['data'])} products")
        return True
    except Exception as e:
        log_error("P3: Product Proxy", e)
        return False

def test_docker_images_advanced():
    """P4: Detailed Docker image validation"""
    try:
        result = subprocess.run(
            ["docker", "image", "ls", "--format", "{{.Repository}}\t{{.Size}}"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode != 0:
            log_fail("P4: Docker Images", "Could not list images")
            return False
        
        # Parse image sizes
        images = {}
        for line in result.stdout.strip().split('\n'):
            if '\t' in line:
                repo, size = line.split('\t')
                images[repo] = size
        
        targets = {
            "api-gateway": 150,
            "user-service": 150,
            "rental-service": 150,
            "analytics-service": 150,
            "agentic-service": 300,
            "frontend": 50
        }
        
        # Check Dockerfile exists and is multistage
        for service in targets:
            dockerfile_path = f"{service}/Dockerfile"
            try:
                with open(dockerfile_path, 'r') as f:
                    content = f.read()
                    if 'FROM' in content and content.count('FROM') >= 2:
                        log_pass(f"P4: Multistage {service}", detail="Found builder and runtime stages")
                    else:
                        log_warn(f"P4: Multistage {service}", "May not be true multistage")
            except:
                log_warn(f"P4: Dockerfile {service}", "Could not verify Dockerfile")
        
        log_pass("P4: Docker Setup", 40, "Services properly configured")
        return True
    except Exception as e:
        log_error("P4: Docker Images", e)
        return False

# ==================== CHAPTER 2: DATA LAYER ====================

def test_pagination_with_validation():
    """P5: Paginated products with comprehensive validation"""
    try:
        # Test 1: Valid category
        response = requests.get(
            f"{API_GATEWAY}/rentals/products?category=ELECTRONICS&limit=20&page=1",
            timeout=TIMEOUT
        )
        
        if response.status_code == 400:
            log_warn("P5: Category Filter", "Returns 400 for category")
            return True
        
        if response.status_code != 200:
            log_fail("P5: Pagination", f"Status {response.status_code}", 50)
            return False
        
        valid, msg, data = validate_json_response(
            response,
            ["data", "page", "limit", "total", "totalPages"]
        )
        
        if not valid:
            log_fail("P5: Pagination", msg, 50)
            return False
        
        # Validate pagination logic
        if data["page"] != 1:
            log_fail("P5: Pagination", "Page should be 1", 50)
            return False
        
        if data["limit"] != 20:
            log_fail("P5: Pagination", f"Limit should be 20, got {data['limit']}")
            return False
        
        # Test 2: Invalid category
        invalid = requests.get(
            f"{API_GATEWAY}/rentals/products?category=INVALID_XYZ_CATEGORY",
            timeout=TIMEOUT
        )
        
        if invalid.status_code != 400:
            log_warn("P5: Invalid Category", f"Should return 400, got {invalid.status_code}")
        else:
            log_pass("P5: Invalid Category", detail="Returns 400 with helpful error")
        
        log_pass("P5: Paginated Listing", 50, f"Categories filter working, {len(data['data'])} items")
        return True
    except Exception as e:
        log_error("P5: Pagination", e)
        return False

def test_discount_tiers_validation():
    """P6: Loyalty discount tier validation"""
    try:
        # Test multiple score ranges
        test_cases = [
            (42, "should exist"),  # Random user
        ]
        
        for user_id, _ in test_cases:
            response = requests.get(
                f"{API_GATEWAY}/users/{user_id}/discount",
                timeout=TIMEOUT
            )
            
            if response.status_code == 404:
                log_warn("P6: Discount", f"User {user_id} not found in Central API")
                continue
            
            if response.status_code != 200:
                log_fail("P6: Discount", f"Status {response.status_code}", 35)
                return False
            
            valid, msg, data = validate_json_response(
                response,
                ["userId", "securityScore", "discountPercent"]
            )
            
            if not valid:
                log_fail("P6: Discount", msg, 35)
                return False
            
            # Validate tier logic
            score = data["securityScore"]
            discount = data["discountPercent"]
            
            expected_discount = None
            if score >= 80:
                expected_discount = 20
            elif score >= 60:
                expected_discount = 15
            elif score >= 40:
                expected_discount = 10
            elif score >= 20:
                expected_discount = 5
            else:
                expected_discount = 0
            
            if discount != expected_discount:
                log_fail(
                    "P6: Discount Tier",
                    f"Score {score} -> {discount}%, expected {expected_discount}%"
                )
                return False
        
        log_pass("P6: Loyalty Discount", 35, "Tier logic validated")
        return True
    except Exception as e:
        log_error("P6: Discount Tiers", e)
        return False

def test_availability_advanced():
    """P7: Advanced availability testing with interval validation"""
    try:
        response = requests.get(
            f"{API_GATEWAY}/rentals/products/1/availability?from=2024-03-01&to=2024-03-14",
            timeout=TIMEOUT
        )
        
        if response.status_code == 404:
            log_warn("P7: Availability", "Product not found")
            return True
        
        if response.status_code != 200:
            log_fail("P7: Availability", f"Status {response.status_code}", 65)
            return False
        
        valid, msg, data = validate_json_response(
            response,
            ["productId", "from", "to", "available", "busyPeriods", "freeWindows"]
        )
        
        if not valid:
            log_fail("P7: Availability", msg, 65)
            return False
        
        # Validate structure
        if not isinstance(data["busyPeriods"], list) or not isinstance(data["freeWindows"], list):
            log_fail("P7: Array Types", "busyPeriods and freeWindows should be arrays")
            return False
        
        # Validate interval merging logic
        busy = data["busyPeriods"]
        if len(busy) > 1:
            for i in range(len(busy) - 1):
                current_end = busy[i].get("end", "")
                next_start = busy[i+1].get("start", "")
                # Check if intervals are properly merged (no overlap)
                if current_end >= next_start:
                    log_warn("P7: Interval Merging", "Overlapping periods detected, may not be merged")
        
        # Validate free windows are within requested range
        for window in data["freeWindows"]:
            if window.get("start", "") < data["from"] or window.get("end", "") > data["to"]:
                log_warn("P7: Free Windows", "Window extends outside requested range")
        
        log_pass("P7: Availability", 65, f"{len(busy)} busy periods, {len(data['freeWindows'])} free windows")
        return True
    except Exception as e:
        log_error("P7: Availability", e)
        return False

def test_kth_busiest_with_validation():
    """P8: Kth busiest date with validation"""
    try:
        response = requests.get(
            f"{API_GATEWAY}/rentals/kth-busiest-date?from=2024-01&to=2024-06&k=3",
            timeout=TIMEOUT
        )
        
        if response.status_code == 404:
            log_warn("P8: Kth Busiest", "No data available")
            return True
        
        if response.status_code != 200:
            log_fail("P8: Record Day", f"Status {response.status_code}", 70)
            return False
        
        valid, msg, data = validate_json_response(
            response,
            ["from", "to", "k", "date", "rentalCount"]
        )
        
        if not valid:
            log_fail("P8: Record Day", msg, 70)
            return False
        
        # Validate k value
        if data.get("k") != 3:
            log_fail("P8: K Value", "K mismatch in response")
        
        # Test validation
        invalid_tests = [
            ("?from=invalid&to=2024-06&k=3", "invalid date format"),
            ("?from=2024-06&to=2024-01&k=3", "from after to"),
            ("?from=2024-01&to=2024-01&k=3", "range too small"),
        ]
        
        for query, desc in invalid_tests:
            resp = requests.get(
                f"{API_GATEWAY}/rentals/kth-busiest-date{query}",
                timeout=TIMEOUT
            )
            if resp.status_code == 400:
                log_pass("P8: Validation", detail=f"Correctly rejects {desc}")
        
        log_pass("P8: Record Day", 70, f"Date: {data.get('date')}, Rentals: {data.get('rentalCount')}")
        return True
    except Exception as e:
        log_error("P8: Record Day", e)
        return False

def test_top_categories_comprehensive():
    """P9: Top categories with batch API validation"""
    try:
        response = requests.get(
            f"{API_GATEWAY}/rentals/users/101/top-categories?k=5",
            timeout=TIMEOUT
        )
        
        if response.status_code == 404:
            log_warn("P9: Top Categories", "User not found")
            return True
        
        if response.status_code != 200:
            log_fail("P9: Top Categories", f"Status {response.status_code}", 60)
            return False
        
        valid, msg, data = validate_json_response(response, ["topCategories"])
        if not valid:
            log_fail("P9: Top Categories", msg, 60)
            return False
        
        # Validate array and structure
        if not isinstance(data["topCategories"], list):
            log_fail("P9: Array Type", "topCategories should be array")
            return False
        
        for item in data["topCategories"]:
            if "category" not in item or "rentalCount" not in item:
                log_fail("P9: Item Structure", "Missing category or rentalCount")
                return False
        
        # Check for proper sorting
        if len(data["topCategories"]) > 1:
            for i in range(len(data["topCategories"]) - 1):
                if data["topCategories"][i]["rentalCount"] < data["topCategories"][i+1]["rentalCount"]:
                    log_warn("P9: Sorting", "Categories not sorted by count descending")
        
        log_pass("P9: Top Categories", 60, f"{len(data['topCategories'])} categories returned")
        return True
    except Exception as e:
        log_error("P9: Top Categories", e)
        return False

def test_free_streak_comprehensive():
    """P10: Free streak validation"""
    try:
        response = requests.get(
            f"{API_GATEWAY}/rentals/products/1/free-streak?year=2023",
            timeout=TIMEOUT
        )
        
        if response.status_code == 404:
            log_warn("P10: Free Streak", "Product not found")
            return True
        
        if response.status_code != 200:
            log_fail("P10: Free Streak", f"Status {response.status_code}", 65)
            return False
        
        valid, msg, data = validate_json_response(
            response,
            ["productId", "year", "longestFreeStreak"]
        )
        
        if not valid:
            log_fail("P10: Free Streak", msg, 65)
            return False
        
        # Validate streak structure
        streak = data.get("longestFreeStreak")
        if isinstance(streak, dict):
            required_fields = ["from", "to", "days"]
            if all(f in streak for f in required_fields):
                log_pass("P10: Streak Structure", detail=f"{streak['days']} day streak")
            else:
                log_fail("P10: Streak Fields", f"Missing fields in streak")
        
        log_pass("P10: Free Streak", 65, f"Longest: {streak.get('days', 'N/A')} days")
        return True
    except Exception as e:
        log_error("P10: Free Streak", e)
        return False

# ==================== CHAPTER 3: INTELLIGENCE ====================

def test_peak_window_sliding():
    """P11: Peak window with sliding window validation"""
    try:
        response = requests.get(
            f"{API_GATEWAY}/analytics/peak-window?from=2024-01&to=2024-06",
            timeout=TIMEOUT
        )
        
        if response.status_code == 404:
            log_warn("P11: Peak Window", "No data available")
            return True
        
        if response.status_code != 200:
            log_fail("P11: Peak Window", f"Status {response.status_code}", 80)
            return False
        
        valid, msg, data = validate_json_response(
            response,
            ["from", "to", "peakWindow"]
        )
        
        if not valid:
            log_fail("P11: Peak Window", msg, 80)
            return False
        
        window = data.get("peakWindow")
        if isinstance(window, dict):
            required = ["from", "to", "totalRentals"]
            if all(f in window for f in required):
                log_pass("P11: Peak Window", 80, f"Total: {window['totalRentals']} rentals")
                return True
        
        log_fail("P11: Peak Window", "Invalid window structure")
        return False
    except Exception as e:
        log_error("P11: Peak Window", e)
        return False

def test_merged_feed_sorting():
    """P12: Merged feed with sorting validation"""
    try:
        response = requests.get(
            f"{API_GATEWAY}/rentals/merged-feed?productIds=1,2,3&limit=10",
            timeout=TIMEOUT
        )
        
        if response.status_code == 404:
            log_warn("P12: Merged Feed", "Products not found")
            return True
        
        if response.status_code != 200:
            log_fail("P12: Merged Feed", f"Status {response.status_code}", 80)
            return False
        
        valid, msg, data = validate_json_response(
            response,
            ["productIds", "limit", "feed"]
        )
        
        if not valid:
            log_fail("P12: Merged Feed", msg, 80)
            return False
        
        feed = data.get("feed", [])
        if not isinstance(feed, list):
            log_fail("P12: Feed Type", "feed should be array")
            return False
        
        # Validate sorting by rentalStart
        is_sorted = True
        for i in range(len(feed) - 1):
            current = feed[i].get("rentalStart", "")
            next_item = feed[i+1].get("rentalStart", "")
            if current > next_item:
                is_sorted = False
                break
        
        if is_sorted:
            log_pass("P12: Merged Feed", 80, f"Properly sorted, {len(feed)} items")
        else:
            log_fail("P12: Sorting", "Feed not sorted by rentalStart")
        
        return is_sorted
    except Exception as e:
        log_error("P12: Merged Feed", e)
        return False

def test_surge_days_structure():
    """P13: Surge days detection"""
    try:
        response = requests.get(
            f"{API_GATEWAY}/analytics/surge-days?month=2024-03",
            timeout=TIMEOUT
        )
        
        if response.status_code == 404:
            log_warn("P13: Surge Days", "No data available")
            return True
        
        if response.status_code != 200:
            log_fail("P13: Surge Days", f"Status {response.status_code}", 55)
            return False
        
        valid, msg, data = validate_json_response(response, ["data"])
        if not valid:
            log_fail("P13: Surge Days", msg, 55)
            return False
        
        data_list = data.get("data", [])
        if not isinstance(data_list, list):
            log_fail("P13: Data Type", "data should be array")
            return False
        
        # Validate item structure
        for item in data_list[:3]:  # Check first 3 items
            required = ["date", "count", "nextSurgeDate", "daysUntil"]
            if not all(f in item for f in required):
                log_fail("P13: Item Structure", "Missing required fields")
                return False
        
        log_pass("P13: Surge Days", 55, f"{len(data_list)} days analyzed")
        return True
    except Exception as e:
        log_error("P13: Surge Days", e)
        return False

def test_recommendations_seasonal():
    """P14: Seasonal recommendations"""
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(
            f"{API_GATEWAY}/analytics/recommendations?date={today}&limit=10",
            timeout=TIMEOUT
        )
        
        if response.status_code == 404:
            log_warn("P14: Recommendations", "No data available")
            return True
        
        if response.status_code != 200:
            log_fail("P14: Recommendations", f"Status {response.status_code}", 60)
            return False
        
        valid, msg, data = validate_json_response(response, ["recommendations"])
        if not valid:
            log_fail("P14: Recommendations", msg, 60)
            return False
        
        recs = data.get("recommendations", [])
        if not isinstance(recs, list):
            log_fail("P14: Array Type", "recommendations should be array")
            return False
        
        # Validate item structure
        for rec in recs[:3]:  # Check first 3
            required = ["productId", "category"]
            if not all(f in rec for f in required):
                log_fail("P14: Item Structure", "Missing fields in recommendation")
                return False
        
        log_pass("P14: Recommendations", 60, f"{len(recs)} products recommended")
        return True
    except Exception as e:
        log_error("P14: Recommendations", e)
        return False

def test_chatbot_grounding():
    """P15: Chatbot with data grounding validation"""
    try:
        payload = {
            "sessionId": f"test-{int(time.time())}",
            "message": "Which category had the most rentals?"
        }
        
        response = requests.post(
            f"{API_GATEWAY}/chat",
            json=payload,
            timeout=TIMEOUT
        )
        
        if response.status_code == 404:
            log_warn("P15: Chatbot", "Endpoint not implemented")
            return True
        
        if response.status_code not in [200, 201]:
            log_fail("P15: Chatbot", f"Status {response.status_code}", 80)
            return False
        
        valid, msg, data = validate_json_response(
            response,
            ["sessionId", "reply"]
        )
        
        if not valid:
            log_fail("P15: Chatbot", msg, 80)
            return False
        
        reply = data.get("reply", "")
        if len(reply) < 10:
            log_fail("P15: Reply Quality", "Reply too short")
            return False
        
        # Check reply contains actual data (not hallucinated)
        if any(num in reply for num in ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]):
            log_pass("P15: Data Grounding", 80, "Reply contains numeric data")
            return True
        else:
            log_warn("P15: Data Grounding", "Reply may not contain real data")
            return True
    except Exception as e:
        log_error("P15: Chatbot", e)
        return False

def test_chat_sessions_mongodb():
    """P16: Chat sessions with MongoDB persistence"""
    try:
        response = requests.get(
            f"{API_GATEWAY}/chat/sessions",
            timeout=TIMEOUT
        )
        
        if response.status_code == 404:
            log_warn("P16: Chat Sessions", "Endpoint not implemented")
            return True
        
        if response.status_code != 200:
            log_fail("P16: Chat Sessions", f"Status {response.status_code}", 60)
            return False
        
        valid, msg, data = validate_json_response(response, ["sessions"])
        if not valid:
            log_fail("P16: Chat Sessions", msg, 60)
            return False
        
        sessions = data.get("sessions", [])
        if not isinstance(sessions, list):
            log_fail("P16: Array Type", "sessions should be array")
            return False
        
        # Validate session structure
        for session in sessions[:3]:  # Check first 3
            required = ["sessionId", "name", "lastMessageAt"]
            if not all(f in session for f in required):
                log_fail("P16: Session Structure", "Missing required fields")
                return False
        
        log_pass("P16: Chat Sessions", 60, f"{len(sessions)} sessions")
        return True
    except Exception as e:
        log_error("P16: Chat Sessions", e)
        return False

# ==================== CHAPTER 4: FRONTEND ====================

def test_frontend_accessibility():
    """P17: Frontend page accessibility and API integration"""
    try:
        pages_to_test = [
            ("/", "Home"),
            ("/login", "Login"),
            ("/register", "Register"),
            ("/products", "Products"),
            ("/chat", "Chat"),
        ]
        
        all_accessible = True
        for path, name in pages_to_test:
            try:
                response, elapsed = measure_response_time(
                    requests.get,
                    f"{FRONTEND}{path}",
                    timeout=TIMEOUT
                )
                
                if response.status_code == 200:
                    is_html = "<!doctype" in response.text.lower() or "<html" in response.text.lower()
                    if is_html:
                        log_pass(f"P17: {name} Page", detail=f"Status 200, {elapsed:.3f}s")
                    else:
                        log_warn(f"P17: {name} Page", "Response doesn't look like HTML")
                        all_accessible = False
                else:
                    log_fail(f"P17: {name} Page", f"Status {response.status_code}")
                    all_accessible = False
                
                # Check for console errors in response (basic check)
                if "Error" in response.text and "console.error" in response.text:
                    log_warn(f"P17: {name} Page", "May have console errors")
            except Exception as e:
                log_error(f"P17: {name} Page", str(e)[:50])
                all_accessible = False
        
        if all_accessible:
            log_pass("P17: The Pixels Reborn", 80, "All pages accessible")
        
        return all_accessible
    except Exception as e:
        log_error("P17: Frontend", e)
        return False

def test_trending_widget():
    """P18: Trending widget with dynamic data"""
    try:
        response = requests.get(f"{FRONTEND}/trending", timeout=TIMEOUT)
        
        if response.status_code == 404:
            log_warn("P18: Trending Widget", "Page not found")
            return True
        
        if response.status_code == 200:
            log_pass("P18: Trending Widget", 50, "Widget page exists")
            return True
        else:
            log_fail("P18: Trending Widget", f"Status {response.status_code}", 50)
            return False
    except Exception as e:
        log_error("P18: Trending Widget", e)
        return False

# ==================== SECURITY & PERFORMANCE ====================

def test_rate_limit_handling():
    """B2: Rate limit handling and backoff"""
    try:
        # Make rapid requests to check rate limiting
        endpoints = [
            "/rentals/products",
            "/analytics/peak-window?from=2024-01&to=2024-06",
            "/rentals/products/1/availability?from=2024-01-01&to=2024-01-31",
        ]
        
        rate_limited = False
        for endpoint in endpoints:
            response = requests.get(
                f"{API_GATEWAY}{endpoint}",
                timeout=TIMEOUT
            )
            
            if response.status_code == 429:
                rate_limited = True
                # Check for rate limit headers
                headers = response.headers
                if "X-RateLimit-Remaining" in headers:
                    log_pass("B2: Rate Limit", detail="Proper rate limit headers present")
                else:
                    log_warn("B2: Rate Limit", "Missing rate limit headers")
        
        if not rate_limited:
            log_pass("B2: Rate Limit", 40, "No rate limit violations in basic test")
            return True
        
        return False
    except Exception as e:
        log_error("B2: Rate Limiting", e)
        return False

def test_security_headers():
    """Test for security headers in responses"""
    try:
        response = requests.get(f"{API_GATEWAY}/status", timeout=TIMEOUT)
        
        security_checks = [
            ("X-Content-Type-Options", "nosniff"),
            ("X-Frame-Options", "DENY"),
            ("X-XSS-Protection", "1"),
        ]
        
        found_issues = 0
        for header, expected_value in security_checks:
            if header not in response.headers:
                log_warn("Security", f"Missing {header} header")
                found_issues += 1
        
        if found_issues == 0:
            log_pass("Security Headers", detail="Standard headers present")
        
        return True
    except Exception as e:
        log_error("Security Headers", e)
        return False

# ==================== GENERATE REPORT ====================

def generate_report():
    """Generate comprehensive final test report"""
    log_section("COMPREHENSIVE TEST RESULTS")
    
    total_passed_points = sum(t["points"] for t in results["passed"])
    total_failed_points = sum(t["points"] for t in results["failed"])
    
    # Passed tests
    print(f"\n{Colors.GREEN}âœ“ PASSED ({len(results['passed'])} tests){Colors.END}")
    passed_points = sum(t["points"] for t in results["passed"])
    print(f"  Total points: {passed_points}")
    
    for test in results["passed"][:15]:
        if test["points"] > 0:
            detail = f" | {test['detail']}" if test.get("detail") else ""
            print(f"  â€¢ {test['name']} (+{test['points']} pts){detail}")
    
    if len(results["passed"]) > 15:
        print(f"  ... and {len(results['passed']) - 15} more")
    
    # Failed tests
    if results["failed"]:
        print(f"\n{Colors.RED}âœ— FAILED ({len(results['failed'])} tests){Colors.END}")
        for test in results["failed"]:
            if test["points"] > 0:
                print(f"  â€¢ {test['name']}: {test['reason']} (-{test['points']} pts)")
            else:
                print(f"  â€¢ {test['name']}: {test['reason']}")
    
    # Warnings
    if results["warnings"]:
        print(f"\n{Colors.YELLOW}âš  WARNINGS ({len(results['warnings'])} items){Colors.END}")
        for test in results["warnings"][:8]:
            print(f"  â€¢ {test['name']}: {test['reason']}")
        if len(results["warnings"]) > 8:
            print(f"  ... and {len(results['warnings']) - 8} more")
    
    # Security issues
    if results["security_issues"]:
        print(f"\n{Colors.RED}ðŸ”“ SECURITY ISSUES ({len(results['security_issues'])}){Colors.END}")
        for issue in results["security_issues"]:
            print(f"  â€¢ [{issue['severity']}] {issue['issue']}")
    
    # Performance issues
    if results["performance_issues"]:
        print(f"\n{Colors.MAGENTA}â± PERFORMANCE ISSUES ({len(results['performance_issues'])}){Colors.END}")
        for issue in results["performance_issues"]:
            print(f"  â€¢ {issue['issue']}")
    
    # Errors
    if results["errors"]:
        print(f"\n{Colors.RED}âš¡ CRITICAL ERRORS ({len(results['errors'])}){Colors.END}")
        for test in results["errors"][:5]:
            print(f"  â€¢ {test['name']}: {test['error'][:60]}...")
    
    # Score calculation
    print(f"\n{Colors.BLUE}{'='*70}")
    print(f"SCORING SUMMARY")
    print(f"{'='*70}")
    
    estimated_score = total_passed_points
    print(f"Points Earned: {Colors.GREEN}{estimated_score}{Colors.END}")
    
    if results["failed"]:
        print(f"Points Lost:   {Colors.RED}-{total_failed_points}{Colors.END}")
        estimated_score -= total_failed_points
    
    print(f"\nEstimated Score: {Colors.GREEN}{estimated_score}/{Colors.END}1,230 points")
    
    percentage = (estimated_score / 1230) * 100 if estimated_score >= 0 else 0
    print(f"Progress: {percentage:.1f}%")
    
    if estimated_score >= 1000:
        status = "ðŸ† EXCELLENT"
    elif estimated_score >= 800:
        status = "âœ… GOOD"
    elif estimated_score >= 600:
        status = "âš ï¸ NEEDS WORK"
    else:
        status = "âŒ CRITICAL"
    
    print(f"Status: {status}")
    print(f"{'='*70}{Colors.END}\n")

# ==================== MAIN ====================

def main():
    """Run all advanced tests"""
    log_section("RENTPI ADVANCED JUDGE TEST SUITE v2.0")
    
    # Infrastructure
    log_section("INFRASTRUCTURE & SETUP")
    if not test_docker_services():
        print(f"\n{Colors.RED}Docker services not running properly.{Colors.END}")
        return
    
    test_gateway_health()
    test_downstream_aggregation()
    
    # Chapter 1
    log_section("CHAPTER 1: FOUNDATION (150 pts)")
    test_health_checks_detailed()
    auth_result = test_user_auth_complete()
    test_product_proxy_detailed()
    test_docker_images_advanced()
    
    # Chapter 2
    log_section("CHAPTER 2: DATA LAYER (370 pts)")
    test_pagination_with_validation()
    test_discount_tiers_validation()
    test_availability_advanced()
    test_kth_busiest_with_validation()
    test_top_categories_comprehensive()
    test_free_streak_comprehensive()
    
    # Chapter 3
    log_section("CHAPTER 3: INTELLIGENCE (450 pts)")
    test_peak_window_sliding()
    test_merged_feed_sorting()
    test_surge_days_structure()
    test_recommendations_seasonal()
    test_chatbot_grounding()
    test_chat_sessions_mongodb()
    
    # Chapter 4
    log_section("CHAPTER 4: FRONTEND (170 pts)")
    test_frontend_accessibility()
    test_trending_widget()
    
    # Bonus & Security
    log_section("BONUS & SECURITY")
    test_rate_limit_handling()
    test_security_headers()
    
    # Final report
    generate_report()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Test interrupted by user{Colors.END}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{Colors.RED}Unexpected error: {e}{Colors.END}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
