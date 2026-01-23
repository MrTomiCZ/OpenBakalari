require('dotenv').config();
const express = require("express");
const xprs = express();
const PORT = process.env.PORT || 8616
const ver = process.env.APIVER;
const appver = process.env.APPVER;
const path = require("path");
const fs = require("fs");

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
        res.status(405).header("Content-Type", "application/json").send(`{"Message":"The requested resource does not support http method '${req.method}'."}`);
    };
    res.header("Content-Type", "application/json").send(`{"ApiVersion":"${process.env.APIVER}","ApplicationVersion":"${process.env.APPVER}","BaseUrl":"api/3"}`);
});

xprs.use("/api", (req, res) => {
    if (req.method !== "GET") {
        res.status(405).header("Content-Type", "application/json").send(`{"Message":"The requested resource does not support http method '${req.method}'."}`);
    };
    res.header("Content-Type", "application/json").send(`[{"ApiVersion":"${process.env.APIVER}","ApplicationVersion":"${process.env.APPVER}","BaseUrl":"api/3"}]`);
});

xprs.use("/api/login", (req, res) => {
    if (req.method !== "POST") {
        res.status(400).header("Content-Type", "application/json").send(`{"Message":"The requested resource does not support http method '${req.method}'."}`);
    }
    // Načtení dat z databáze
    const dataPath = path.join(__dirname, '..', 'database', 'data.json');
    let data = {};

    try {
        if (fs.existsSync(dataPath)) {
            const fileData = fs.readFileSync(dataPath, 'utf8');
            data = JSON.parse(fileData);
        }
    } catch (error) {
        console.error('Chyba při čtení databáze:', error);
        return;
    }
    const params = new URLSearchParams(req.body);
    const sur = params.get("username");
    const pasword = params.get("password");
    if (params.get("grant_type") !== "password" || params.get("client_id") !== "ANDR")
        res.status(400).header("Content-Type", "application/json").send('{"Message":"Request is malformed.","OPENBK_REASON":"grant_type is not password or client_id ANDR."}');
    res.header("Content-Type", "application/json").send(`
        {
           "bak:ApiVersion":"${ver}",
           "bak:AppVersion":"${appver}",
           "bak:UserId":"${data[sur].id}",
           "access_token":"ACCESSTOKEN - 2556 znaků",
           "refresh_token":"REFRESHTOKEN - 3459 znaků",
           "id_token":"id_token - 872 znaků",  //není vždy dostupné
           "token_type":"Bearer",
           "expires_in":3599,
           "scope":"openid profile offline_access bakalari_api"
        }`);
});
