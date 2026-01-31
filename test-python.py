#!/usr/bin/env python3
# Test script to verify Python installation

print("==========================================")
print("Python Installation Test")
print("==========================================")

import sys
print(f"Python Version: {sys.version}")
print(f"Python Executable: {sys.executable}")
print(f"Python Path: {sys.path}")

print("\nTesting basic functionality...")
print("1 + 1 =", 1 + 1)
print("Current directory:", __file__)

print("\n✅ Python is working correctly!")
print("==========================================")
