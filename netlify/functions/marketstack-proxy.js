const https = require("https");
const { URL } = require("url");

/**
 * Simple Netlify function that proxies Marketstack V2 to avoid CORS
 * Query params:
 *   - endpoint: eod | intraday | ticks | exchanges | etc (defaults to 'eod')
 *   - symbols: e.g. AAPL,MSFT
 *   - date_from, date_to, interval, limit, offset, sort, etc.
 * It will forward all query params (except endpoint) to Marketstack.
 */
exports.handler = async (event, context) => {
  try {
    const params = new URLSearchParams(event.queryStringParameters || {});
    const endpoint = (params.get("endpoint") || "eod").replace(/^\//, "");
    params.delete("endpoint");

    // Find API key from any of these env vars
    const access_key = process.env.REACT_APP_MARKETSTACK_KEY 
                    || process.env.MARKETSTACK_KEY 
                    || process.env.REACT_APP_API_KEY;

    if (!access_key) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ok: false, error: "Missing Marketstack key in env (REACT_APP_MARKETSTACK_KEY or MARKETSTACK_KEY)" })
      };
    }

    params.set("access_key", access_key);

    const base = `https://api.marketstack.com/v2/${endpoint}`;
    const fullUrl = `${base}?${params.toString()}`;

    // Wrap https.get in a Promise
    const fetchHttps = (url) => new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
      }).on("error", reject);
    });

    const upstream = await fetchHttps(fullUrl);

    // Pass through upstream response with CORS headers for the browser
    return {
      statusCode: upstream.statusCode || 200,
      headers: {
        "content-type": upstream.headers["content-type"] || "application/json",
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS"
      },
      body: upstream.body
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
      body: JSON.stringify({ ok: false, error: err.message || String(err) })
    };
  }
};
