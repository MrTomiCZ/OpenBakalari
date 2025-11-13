const express = require("express");
const xprs = express();
const PORT = 8453;

xprs.listen(PORT, function (err) {
    if (err) console.error("❌ Express tě nechce odposlouchávat:",err);
    console.log("✅ Express tě odposlouchává na portu "+PORT);
});

xprs.get("/info", (req, res) => {
    res.send("200 OK");
});
