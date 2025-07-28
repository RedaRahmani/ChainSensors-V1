#!/bin/bash

# Create a smaller version of the logo using ffmpeg (if available)
echo "Creating optimized logo..."

INPUT_FILE="/home/oussama/chainsensorWork/ChainSensors-V1/frontend/public/images/sensors/sensor-logo.png"
OUTPUT_FILE="/home/oussama/chainsensorWork/ChainSensors-V1/frontend/public/images/sensors/sensor-logo-512.png"

# Check if the original file exists
if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: Original logo file not found at $INPUT_FILE"
    exit 1
fi

echo "Original file size: $(stat -c%s "$INPUT_FILE") bytes"

# Use ffmpeg to resize and optimize (if available)
if command -v ffmpeg &> /dev/null; then
    echo "Using ffmpeg to optimize..."
    ffmpeg -i "$INPUT_FILE" -vf "scale=512:512" -y "$OUTPUT_FILE" 2>/dev/null
    echo "Optimized file size: $(stat -c%s "$OUTPUT_FILE") bytes"
    echo "Optimized logo created: $OUTPUT_FILE"
else
    echo "ffmpeg not available, copying original file..."
    cp "$INPUT_FILE" "$OUTPUT_FILE"
fi
