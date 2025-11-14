#!/bin/bash

# Traffic Generation Script for Observability Stack
# This script generates realistic traffic patterns including inter-service calls

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Service endpoints
PYTHON_SERVICE="http://localhost:8001"
GO_SERVICE="http://localhost:8002"
RUST_SERVICE="http://localhost:8003"
NEXTJS_FRONTEND="http://localhost:3001"

# Configuration
DURATION=${1:-300}  # Default 5 minutes
REQUESTS_PER_SECOND=${2:-2}
SLEEP_TIME=$(awk "BEGIN {print 1/$REQUESTS_PER_SECOND}")

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Traffic Generator for Observability${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Duration:${NC} ${DURATION} seconds"
echo -e "${GREEN}Requests/second:${NC} ${REQUESTS_PER_SECOND}"
echo -e "${GREEN}Sleep between requests:${NC} ${SLEEP_TIME}s"
echo ""

# Function to make a request and log it
make_request() {
    local service_name=$1
    local endpoint=$2
    local description=$3
    
    response_code=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint" 2>/dev/null || echo "000")
    
    if [ "$response_code" = "200" ] || [ "$response_code" = "500" ]; then
        echo -e "${GREEN}✓${NC} [$service_name] $description - HTTP $response_code"
    else
        echo -e "${RED}✗${NC} [$service_name] $description - HTTP $response_code"
    fi
}

# Function to simulate a user journey (frontend -> backend services)
user_journey() {
    local journey_type=$1
    
    case $journey_type in
        1)
            # Journey 1: User visits frontend, loads data from all services
            echo -e "${YELLOW}→ User Journey: Loading Dashboard${NC}"
            make_request "Frontend" "$NEXTJS_FRONTEND" "Load homepage"
            sleep 0.2
            make_request "Python" "$PYTHON_SERVICE/" "Fetch Python status"
            make_request "Go" "$GO_SERVICE/" "Fetch Go status"
            make_request "Rust" "$RUST_SERVICE/" "Fetch Rust status"
            ;;
        2)
            # Journey 2: User requests data from all services
            echo -e "${YELLOW}→ User Journey: Fetching Data${NC}"
            make_request "Python" "$PYTHON_SERVICE/data" "Fetch Python data"
            sleep 0.1
            make_request "Go" "$GO_SERVICE/data" "Fetch Go data"
            sleep 0.1
            make_request "Rust" "$RUST_SERVICE/data" "Fetch Rust data"
            ;;
        3)
            # Journey 3: Trigger error scenario
            echo -e "${YELLOW}→ User Journey: Error Handling${NC}"
            make_request "Python" "$PYTHON_SERVICE/error" "Trigger Python error"
            ;;
        4)
            # Journey 4: Heavy load on Python service
            echo -e "${YELLOW}→ User Journey: Python Heavy Load${NC}"
            make_request "Python" "$PYTHON_SERVICE/" "Python root"
            make_request "Python" "$PYTHON_SERVICE/data" "Python data"
            make_request "Python" "$PYTHON_SERVICE/data" "Python data again"
            ;;
        5)
            # Journey 5: Heavy load on Go service
            echo -e "${YELLOW}→ User Journey: Go Heavy Load${NC}"
            make_request "Go" "$GO_SERVICE/" "Go root"
            make_request "Go" "$GO_SERVICE/data" "Go data"
            make_request "Go" "$GO_SERVICE/data" "Go data again"
            ;;
        6)
            # Journey 6: Heavy load on Rust service
            echo -e "${YELLOW}→ User Journey: Rust Heavy Load${NC}"
            make_request "Rust" "$RUST_SERVICE/" "Rust root"
            make_request "Rust" "$RUST_SERVICE/data" "Rust data"
            make_request "Rust" "$RUST_SERVICE/data" "Rust data again"
            ;;
        7)
            # Journey 7: Random single service call
            services=("$PYTHON_SERVICE" "$GO_SERVICE" "$RUST_SERVICE")
            endpoints=("/" "/data")
            random_service=${services[$RANDOM % ${#services[@]}]}
            random_endpoint=${endpoints[$RANDOM % ${#endpoints[@]}]}
            
            if [[ $random_service == *"8001"* ]]; then
                service_name="Python"
            elif [[ $random_service == *"8002"* ]]; then
                service_name="Go"
            else
                service_name="Rust"
            fi
            
            make_request "$service_name" "$random_service$random_endpoint" "Random call"
            ;;
        8)
            # Journey 8: Error scenario on different services
            echo -e "${YELLOW}→ User Journey: Multi-Service Errors${NC}"
            make_request "Go" "$GO_SERVICE/error" "Trigger Go error"
            sleep 0.1
            make_request "Rust" "$RUST_SERVICE/error" "Trigger Rust error"
            ;;
    esac
}

# Main traffic generation loop
echo -e "${BLUE}Starting traffic generation...${NC}"
echo -e "${BLUE}Press Ctrl+C to stop${NC}"
echo ""

start_time=$(date +%s)
request_count=0

trap 'echo -e "\n${YELLOW}Stopping traffic generation...${NC}"; echo -e "${GREEN}Total requests sent: $request_count${NC}"; exit 0' INT

while true; do
    current_time=$(date +%s)
    elapsed=$((current_time - start_time))
    
    if [ $elapsed -ge $DURATION ]; then
        echo -e "\n${GREEN}Traffic generation completed!${NC}"
        echo -e "${GREEN}Total requests sent: $request_count${NC}"
        echo -e "${GREEN}Duration: ${elapsed}s${NC}"
        break
    fi
    
    # Select a random user journey (weighted towards common paths)
    random=$((RANDOM % 100))
    
    if [ $random -lt 25 ]; then
        # 25% - Dashboard load
        user_journey 1
        request_count=$((request_count + 4))
    elif [ $random -lt 45 ]; then
        # 20% - Data fetching
        user_journey 2
        request_count=$((request_count + 3))
    elif [ $random -lt 50 ]; then
        # 5% - Error scenarios
        user_journey 3
        request_count=$((request_count + 1))
    elif [ $random -lt 60 ]; then
        # 10% - Python heavy load
        user_journey 4
        request_count=$((request_count + 3))
    elif [ $random -lt 70 ]; then
        # 10% - Go heavy load
        user_journey 5
        request_count=$((request_count + 3))
    elif [ $random -lt 80 ]; then
        # 10% - Rust heavy load
        user_journey 6
        request_count=$((request_count + 3))
    elif [ $random -lt 85 ]; then
        # 5% - Multi-service errors
        user_journey 8
        request_count=$((request_count + 2))
    else
        # 15% - Random single calls
        user_journey 7
        request_count=$((request_count + 1))
    fi
    
    # Progress indicator
    if [ $((request_count % 20)) -eq 0 ]; then
        echo -e "${BLUE}Progress: ${elapsed}s / ${DURATION}s | Requests: ${request_count}${NC}"
    fi
    
    sleep $SLEEP_TIME
done

echo ""
echo -e "${GREEN}✓ Traffic generation finished successfully!${NC}"
echo -e "${BLUE}Check your dashboards at:${NC}"
echo -e "  - Grafana: http://localhost:3000"
echo -e "  - Prometheus: http://localhost:9090"
echo -e "  - Tempo: http://localhost:3200"
