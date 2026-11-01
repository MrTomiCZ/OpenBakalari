const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");

const SRC = path.join(__dirname, "..");
const ROOT = path.join(SRC, "..");

test("permanent timetable handles missing and invalid data", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openbakalari-errors-"));
    let server;

    try {
        const srcDir = path.join(tempDir, "src");
        const dataDir = path.join(tempDir, "data");
        const keyDir = path.join(dataDir, "klice");
        const dbDir = path.join(dataDir, "db");
        const timetableDir = path.join(srcDir, "database");

        for (const dir of [srcDir, keyDir, dbDir, timetableDir, path.join(tempDir, "moduly")]) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.copyFileSync(path.join(SRC, "app.js"), path.join(srcDir, "app.js"));
        fs.copyFileSync(path.join(ROOT, "moduly", "user.js"), path.join(tempDir, "moduly", "user.js"));
        fs.copyFileSync(path.join(SRC, "timetable.json"), path.join(srcDir, "timetable.json"));

        fs.symlinkSync(path.join(SRC, "node_modules"), path.join(srcDir, "node_modules"), "dir");

        const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
            modulusLength: 2048,
            publicKeyEncoding: { type: "spki", format: "pem" },
            privateKeyEncoding: { type: "pkcs8", format: "pem" }
        });

        fs.writeFileSync(path.join(keyDir, "jwt-public.pem"), publicKey);
        fs.writeFileSync(path.join(keyDir, "jwt-private.pem"), privateKey);
        fs.writeFileSync(path.join(dbDir, "uzivatele.json"), JSON.stringify([
            { id: "test-user", username: "test" }
        ]));

        const token = jwt.sign(
            { sub: "test-user" },
            privateKey,
            { algorithm: "RS256", expiresIn: "5m" }
        );

        // Use a random free port to avoid conflicts with other tests.
        const net = require("node:net");
        const port = await new Promise((resolve, reject) => {
            const listener = net.createServer();
            listener.once("error", reject);
            listener.listen(0, "127.0.0.1", () => {
                const freePort = listener.address().port;
                listener.close(() => resolve(freePort));
            });
        });

        const baseUrl = `http://127.0.0.1:${port}`;

        server = spawn(process.execPath, ["app.js"], {
            cwd: srcDir,
            env: { ...process.env, PORT: String(port), DEBUG: "" },
            stdio: "ignore"
        });

        let ready = false;

        for (let i = 0; i < 100; i++) {
            if (server.exitCode !== null) break;

            try {
                const response = await fetch(baseUrl);
                if (response.ok) {
                    ready = true;
                    break;
                }
            } catch {
                // server stale nabiha
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        assert.equal(ready, true, "Test server failed to start");

        const request = () => fetch(`${baseUrl}/api/3/timetable/permanent`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        // chybi databaze rozvrhu
        let response = await request();
        assert.equal(response.status, 500);
        let body = await response.json();
        assert.equal(body.Message, "Data rozvrhů hodin se nepodařilo načíst.");

        // nespravny json
        fs.writeFileSync(path.join(timetableDir, "timetables-permanent.json"), "{invalid");
        response = await request();
        assert.equal(response.status, 500);

        // spatna struktura databaze
        fs.writeFileSync(path.join(timetableDir, "timetables-permanent.json"), "{}");
        response = await request();
        assert.equal(response.status, 500);

        // spravna databaze ale zadny rozvrh pro uzivatele
        fs.writeFileSync(path.join(timetableDir, "timetables-permanent.json"), "[]");
        response = await request();
        assert.equal(response.status, 500);
        body = await response.json();
        assert.equal(body.Message, "Rozvrh nenalezen.");
    } finally {
        if (server && server.exitCode === null) {
            server.kill("SIGTERM");
            await once(server, "exit");
        }

        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
