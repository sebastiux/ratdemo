path = r"C:/Users/csohs/OneDrive/Desktop/rattest/control-panel/src/pages/Join.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix duplicate return (
content = content.replace("  return (\n\n  return (", "  return (")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed Join.tsx")
