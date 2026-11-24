package it.nutrifabio.stabbio

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.zip.ZipInputStream

class MainActivity : Activity() {
    private lateinit var web: WebView
    private val requestImport = 20
    private var photoCallback: android.webkit.ValueCallback<Array<Uri>>? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this)
        setContentView(web)
        web.setOnApplyWindowInsetsListener { v, insets ->
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                val bars = insets.getInsets(android.view.WindowInsets.Type.systemBars())
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            }
            insets
        }
        web.requestApplyInsets()
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.allowFileAccess = false
        web.webChromeClient = object : android.webkit.WebChromeClient() {
            override fun onShowFileChooser(view: WebView?, callback: android.webkit.ValueCallback<Array<Uri>>?, params: FileChooserParams?): Boolean {
                photoCallback?.onReceiveValue(null)
                photoCallback = callback
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "image/*"
                }
                startActivityForResult(intent, 21)
                return true
            }
        }
        web.addJavascriptInterface(Bridge(), "Android")
        web.loadUrl("file:///android_asset/index.html")
    }

    inner class Bridge {
        @JavascriptInterface fun fetchInstagramCaption(raw: String) {
            Thread {
                val result = JSONObject()
                try {
                    val uri = Uri.parse(raw.trim())
                    require(uri.scheme == "https" && uri.host in listOf("instagram.com", "www.instagram.com"))
                    val match = Regex("^/(reel|reels|p)/([A-Za-z0-9_-]+)/?$").matchEntire(uri.path ?: "")
                        ?: throw IllegalArgumentException("Link Reel o post non valido")
                    val kind = if (match.groupValues[1] == "p") "p" else "reel"
                    val url = "https://www.instagram.com/$kind/${match.groupValues[2]}/embed/captioned/"
                    val connection = java.net.URL(url).openConnection() as java.net.HttpURLConnection
                    connection.connectTimeout = 15000
                    connection.readTimeout = 15000
                    connection.instanceFollowRedirects = false
                    connection.setRequestProperty("User-Agent", "Mozilla/5.0")
                    connection.setRequestProperty("Accept", "text/html")
                    val html = try {
                        require(connection.responseCode == 200) { "Instagram HTTP ${connection.responseCode}" }
                        connection.inputStream.bufferedReader(Charsets.UTF_8).use { reader ->
                            val buffer = CharArray(4096)
                            val out = StringBuilder()
                            while (out.length < 4000000) {
                                val count = reader.read(buffer)
                                if (count < 0) break
                                out.append(buffer, 0, count)
                            }
                            out.toString()
                        }
                    } finally { connection.disconnect() }
                    result.put("html", html)
                } catch (e: Exception) {
                    result.put("error", e.message ?: "Caption non disponibile")
                }
                runOnUiThread {
                    web.evaluateJavascript("window.NutriApp.captionResult(" + JSONObject.quote(result.toString()) + ")", null)
                }
            }.start()
        }

        @JavascriptInterface fun choosePackage() = runOnUiThread {
            val i = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "application/zip"
                putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/zip", "application/json", "application/octet-stream"))
            }
            startActivityForResult(i, requestImport)
        }

        @JavascriptInterface fun openInstagramImporter() = runOnUiThread {
            val page = Uri.parse("https://giolanni.github.io/NutriFaBioStaBBio-download/analizza.html")
            startActivity(Intent(Intent.ACTION_VIEW, page))
        }
    }

    @Deprecated("Legacy result API used for broad Android compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 21) { photoCallback?.onReceiveValue(if (resultCode == RESULT_OK) data?.data?.let { arrayOf(it) } else null); photoCallback = null; return }
        if (requestCode == requestImport && resultCode == RESULT_OK && data?.data != null) importUri(data.data!!)
    }

    private fun importUri(uri: Uri) {
        try {
            val bytes = contentResolver.openInputStream(uri)!!.use { it.readBytes() }
            val json = if (bytes.take(1).firstOrNull()?.toInt()?.toChar() == '[' || bytes.take(1).firstOrNull()?.toInt()?.toChar() == '{') {
                String(bytes, Charsets.UTF_8)
            } else parseZip(bytes)
            val quoted = JSONObject.quote(json)
            web.evaluateJavascript("window.NutriApp.importPackage($quoted)", null)
        } catch (e: Exception) {
            Toast.makeText(this, "Pacchetto non valido: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    private fun parseZip(bytes: ByteArray): String {
        var recipes: String? = null
        val images = mutableMapOf<String, String>()
        ZipInputStream(bytes.inputStream()).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                val safe = entry.name.replace('\\', '/')
                if (safe.startsWith("/") || safe.contains("../")) throw IllegalArgumentException("Percorso ZIP non sicuro")
                val out = ByteArrayOutputStream(); zip.copyTo(out); val data = out.toByteArray()
                if (safe == "recipes.json") recipes = String(data, Charsets.UTF_8)
                if (safe.startsWith("images/") && data.size <= 5_000_000) {
                    val mime = when { safe.endsWith(".png", true) -> "image/png"; safe.endsWith(".webp", true) -> "image/webp"; else -> "image/jpeg" }
                    images[safe] = "data:$mime;base64," + Base64.encodeToString(data, Base64.NO_WRAP)
                }
            }
        }
        val raw = recipes ?: throw IllegalArgumentException("recipes.json mancante")
        val array = if (raw.trim().startsWith("[")) JSONArray(raw) else JSONObject(raw).optJSONArray("recipes") ?: JSONArray()
        for (i in 0 until array.length()) {
            val recipe = array.getJSONObject(i); val path = recipe.optString("image")
            images[path]?.let { recipe.put("image_data", it) }
        }
        return JSONObject().put("recipes", array).toString()
    }
}
