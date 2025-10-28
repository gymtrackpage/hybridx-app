
package club.hybridx.app;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.CookieManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.graphics.Color;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // REVERT: Go back to letting Android handle system bar fitting
        // We need Android to automatically adjust layout for system bars
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);

        // Set a solid background color for the status bar
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            // Use white to match your app header
            getWindow().setStatusBarColor(Color.WHITE);
            getWindow().setNavigationBarColor(Color.WHITE);
        }

        // Set dark icons for the white status bar
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            View decorView = getWindow().getDecorView();
            int flags = decorView.getSystemUiVisibility();
            flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            decorView.setSystemUiVisibility(flags);
        }

        // Enable WebView data persistence
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebSettings webSettings = this.bridge.getWebView().getSettings();

            // Critical: Enable all storage mechanisms for Firebase Auth
            webSettings.setDatabaseEnabled(true);
            webSettings.setDomStorageEnabled(true);

            // Enable JavaScript (required for web apps)
            webSettings.setJavaScriptEnabled(true);

            // Enable cache for better performance and offline support
            webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);

            // CRITICAL FIX: Configure cookie persistence
            CookieManager cookieManager = CookieManager.getInstance();
            cookieManager.setAcceptCookie(true);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                cookieManager.setAcceptThirdPartyCookies(this.bridge.getWebView(), true);
            }

            // Ensure cookies are flushed to persistent storage immediately
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                cookieManager.flush();
            }

            // CRITICAL: Inject CSS to prevent status bar overlap on EVERY page load
            // This ensures the web content always has safe area padding
            final WebView webView = this.bridge.getWebView();

            // Calculate the actual status bar height in DP (device-independent pixels)
            int statusBarHeightPx = 0;
            int resourceId = getResources().getIdentifier("status_bar_height", "dimen", "android");
            if (resourceId > 0) {
                statusBarHeightPx = getResources().getDimensionPixelSize(resourceId);
            }

            // Convert pixels to DP for consistent sizing across devices
            final float density = getResources().getDisplayMetrics().density;
            final int statusBarHeightDp = statusBarHeightPx > 0 ? Math.round(statusBarHeightPx / density) : 24;

            webView.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);

                    // Inject CSS to add safe area inset CSS variable
                    // Target the root element and let CSS handle it naturally
                    String js =
                        "(function() {" +
                        "  if (!document.getElementById('android-status-bar-fix')) {" +
                        "    var style = document.createElement('style');" +
                        "    style.id = 'android-status-bar-fix';" +
                        "    style.innerHTML = '" +
                        "      :root { " +
                        "        --sat: " + statusBarHeightDp + "px; " +
                        "        --sab: 0px; " +
                        "      } " +
                        "      html { " +
                        "        padding-top: " + statusBarHeightDp + "px !important; " +
                        "        box-sizing: border-box !important; " +
                        "      } " +
                        "      body { " +
                        "        margin-top: 0 !important; " +
                        "      }" +
                        "    ';" +
                        "    document.head.appendChild(style);" +
                        "    console.log('✅ Applied " + statusBarHeightDp + "px status bar padding');" +
                        "  }" +
                        "})();";

                    view.evaluateJavascript(js, null);
                    System.out.println("✅ Injected " + statusBarHeightDp + "px (" + statusBarHeightPx + "px) status bar padding for: " + url);
                }
            });

            System.out.println("✅ WebView persistence configured: Database=" + webSettings.getDatabaseEnabled()
                + ", DOMStorage=" + webSettings.getDomStorageEnabled()
                + ", Cookies=" + cookieManager.acceptCookie());
        }
    }

    @Override
    public void onResume() {
        super.onResume();

        // Force status bar to show and not overlay content
        // The StatusBar plugin config has overlay:false, but we ensure it here
        if (this.bridge != null) {
            this.bridge.getWebView().post(() -> {
                // Execute JavaScript to call Capacitor's StatusBar plugin
                String js =
                    "(async function() {" +
                    "  try {" +
                    "    const { StatusBar } = window.Capacitor.Plugins || {};" +
                    "    if (StatusBar) {" +
                    "      await StatusBar.setOverlaysWebView({ overlay: false });" +
                    "      console.log('✅ StatusBar overlay disabled');" +
                    "    }" +
                    "  } catch(e) { console.log('StatusBar plugin not ready yet'); }" +
                    "})();";

                this.bridge.getWebView().evaluateJavascript(js, null);
                System.out.println("✅ Ensuring StatusBar doesn't overlay content");
            });
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        // Ensure cookies are saved when app goes to background
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().flush();
        }
    }
}
