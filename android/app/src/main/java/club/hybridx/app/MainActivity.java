
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

        // Enable edge-to-edge layout for proper safe-area-inset support
        // This allows the WebView to receive window insets and CSS env(safe-area-inset-*) to work
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

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

            // Configure WebView to properly handle window insets
            // The web app uses CSS env(safe-area-inset-*) which will handle the status bar spacing
            final WebView webView = this.bridge.getWebView();

            // Calculate the actual status bar height for logging purposes
            int statusBarHeightPx = 0;
            int resourceId = getResources().getIdentifier("status_bar_height", "dimen", "android");
            if (resourceId > 0) {
                statusBarHeightPx = getResources().getDimensionPixelSize(resourceId);
            }
            final int finalStatusBarHeightPx = statusBarHeightPx;

            webView.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);

                    // Log that the page loaded - no CSS injection needed
                    // The web app's pt-safe class and safe-area-inset-top will handle spacing
                    System.out.println("✅ Page loaded: " + url + " (status bar: " + finalStatusBarHeightPx + "px, handled by CSS safe-area)");
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
