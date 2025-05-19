#!/bin/bash

# Configuration
TAG_ID="XYZ87654321"
AWS_REGION="ap-south-1"
TOPIC="cattle/$TAG_ID/telemetry"
BATTERY_LEVEL=90  # Initial battery level

echo "Starting IoT Telemetry Simulator"
echo "Press Ctrl+C to stop"
echo "-------------------------------"

while true; do
    # Generate random temperature between 38.0 and 41.0
    TEMP_WHOLE=$((38 + RANDOM % 3))
    TEMP_DECIMAL=$((RANDOM % 100))
    TEMPERATURE="$TEMP_WHOLE.$TEMP_DECIMAL"
    
    # Generate random pulse rate between 60 and 120
    PULSE_RATE=$((60 + RANDOM % 61))
    
    # Generate random motion data between 0.0 and 5.0
    MOTION_WHOLE=$((RANDOM % 5))
    MOTION_DECIMAL=$((RANDOM % 100))
    MOTION_DATA="$MOTION_WHOLE.$MOTION_DECIMAL"
    
    # Occasionally decrease battery level (1% chance)
    if [ $((RANDOM % 100)) -eq 0 ]; then
        BATTERY_LEVEL=$((BATTERY_LEVEL - 1))
        # Make sure battery doesn't go below 0
        if [ $BATTERY_LEVEL -lt 0 ]; then
            BATTERY_LEVEL=0
        fi
    fi
    
    # Create JSON payload
    PAYLOAD="{\"tagId\": \"$TAG_ID\", \"temperature\": $TEMPERATURE, \"pulseRate\": $PULSE_RATE, \"motionData\": $MOTION_DATA, \"batteryLevel\": $BATTERY_LEVEL}"
    
    # Base64 encode the payload
    BASE64_PAYLOAD=$(echo -n "$PAYLOAD" | base64)
    
    # Send to AWS IoT Core
    echo "Sending: $PAYLOAD"
    aws iot-data publish \
        --topic "$TOPIC" \
        --payload "$BASE64_PAYLOAD" \
        --region "$AWS_REGION"
    
    # Check if command succeeded
    if [ $? -eq 0 ]; then
        echo "Published successfully ✅"
    else
        echo "Publish failed ❌"
    fi
    
    echo "-------------------------------"
    
    # Wait 5 seconds
    sleep 5
done
