import { describe, it, expect } from "vitest";
import { isNpxShimPath } from "@designcontext/cli";

// Regression: `npx designcontext setup` puts a temporary shim directory on the child
// process's PATH so `designcontext` can invoke itself. `where`/`which` resolving to that
// shim looked identical to a real `npm install -g` — setup then wrote a bare
// `"command": "designcontext"` into the agent's MCP config, which works during that one
// npx invocation but fails the next time the agent actually starts the MCP server
// (npx's shim dir no longer exists on PATH by then).
describe("isNpxShimPath", () => {
  it("flags Windows npm-cache _npx shim paths", () => {
    expect(
      isNpxShimPath(
        "C:\\Users\\cwber\\AppData\\Local\\npm-cache\\_npx\\446e913bf08222c1\\node_modules\\.bin\\designcontext",
      ),
    ).toBe(true);
  });

  it("flags Unix ~/.npm/_npx shim paths", () => {
    expect(isNpxShimPath("/home/user/.npm/_npx/abc123/node_modules/.bin/designcontext")).toBe(true);
  });

  it("does not flag a real global npm install on Windows", () => {
    expect(isNpxShimPath("C:\\Users\\cwber\\AppData\\Roaming\\npm\\designcontext.cmd")).toBe(false);
  });

  it("does not flag a real global npm install on Unix", () => {
    expect(isNpxShimPath("/usr/local/bin/designcontext")).toBe(false);
  });
});
