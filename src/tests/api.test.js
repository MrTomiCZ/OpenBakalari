
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");

const PORT = 25134;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let server;

before(async () => {
    server = spawn(process.execPath, ["app.js"], {
        cwd: require("node:path").join(__dirname, ".."),
        env: {
            ...process.env,
            PORT: String(PORT),
            DEBUG: ""
        },
        stdio: ["ignore", "pipe", "pipe"]
    });

    const deadline = Date.now() + 15000;

    while (Date.now() < deadline) {
        if (server.exitCode !== null) {
            throw new Error("OpenBakalari server exited during startup");
        }

        try {
            const response = await fetch(BASE_URL);
            if (response.ok) return;
        } catch {
            // server se stale spousti
        }

        await new Promise(resolve => setTimeout(resolve, 200));
    }

    throw new Error("Timed out waiting for OpenBakalari server");
});

after(async () => {
    if (!server) return;

    if (server.exitCode === null) {
        server.kill("SIGTERM");
        await once(server, "exit");
    }
});

test("GET / returns 200", async () => {
    const response = await fetch(BASE_URL);

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "200 ok");
});

test("GET /api returns supported API versions", async () => {
    const response = await fetch(`${BASE_URL}/api`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(body));
    assert.ok(body.length > 0);
    assert.equal(body[0].BaseUrl, "api/3");
});

test("GET /api/3 returns API version information", async () => {
    const response = await fetch(`${BASE_URL}/api/3`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(typeof body.ApiVersion, "string");
    assert.equal(typeof body.ApplicationVersion, "string");
    assert.equal(body.BaseUrl, "api/3");
});

test("POST /api/3 rejects unsupported HTTP method", async () => {
    const response = await fetch(`${BASE_URL}/api/3`, {
        method: "POST"
    });

    assert.equal(response.status, 405);
});

test("GET /api/3/timetable/permanent requires authentication", async () => {
    const response = await fetch(
        `${BASE_URL}/api/3/timetable/permanent`
    );

    assert.equal(response.status, 401);
});

test("GET /api/3/timetable/permanent rejects invalid tokens", async () => {
    const response = await fetch(
        `${BASE_URL}/api/3/timetable/permanent`,
        {
            headers: {
                Authorization: "Bearer invalid-token"
            }
        }
    );

    assert.equal(response.status, 401);

    const body = await response.json();
    assert.equal(
        body.Message,
        "Authorization has been denied for this request."
    );
});

test("POST /api/login rejects missing refresh tokens", async () => {
    const response = await fetch(`${BASE_URL}/api/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            grant_type: "refresh_token"
        })
    });

    assert.equal(response.status, 400);

    const body = await response.json();
    assert.equal(body.error, "invalid_request");
    assert.equal(body.error_description, "Missing refresh_token");
});