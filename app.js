const express = require("express");
const xprs = express();
const PORT = 80;

xprs.listen(PORT, function (err) {
    if (err) console.error("❌ Express tě nechce odposlouchávat:",err);
    console.log("✅ Express tě odposlouchává na portu "+PORT);
});

xprs.get("/", (req, res, next) => {
    if (req.path === "/")
        res.send("200 OK");
    next();
});

xprs.use((req, res, next) => {
    console.log(`➡️  ${req.method} ${req.originalUrl}`);
    next();
});

xprs.use("/api/3", (req, res) => {
    if (req.method !== "GET") {
        res.status(405).send(`{"Message":"The requested resource does not support http method '${req.method}'."}`);
    };
    res.header("Content-Type", "application/json").send('{"ApiVersion":"3.12.0","ApplicationVersion":"1.32.625.2","BaseUrl":"api/3"}');
});

xprs.use("/api", (req, res) => {
    if (req.method !== "GET") {
        res.status(405).send(`{"Message":"The requested resource does not support http method '${req.method}'."}`);
    };
    res.header("Content-Type", "application/json").send('[{"ApiVersion":"3.12.0","ApplicationVersion":"1.32.625.2","BaseUrl":"api/3"}]');
})