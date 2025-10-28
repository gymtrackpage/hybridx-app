
package club.hybridx.app;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.CookieManager;
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

        // CRITICAL FIX: Allow content to draw behind system bars, then handle insets manually
        // This gives us full control over the layout
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

        // Apply window insets to the bridge WebView to prevent overlap with status bar
        View bridgeView = findViewById(com.getcapacitor.android.R.id.webview);
        if (bridgeView != null) {
            ViewCompat.setOnApplyWindowInsetsListener(bridgeView, (v, windowInsets) -> {
                Insets insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());

                // Apply padding to push content below the status bar
                v.setPadding(
                    insets.left,
                    insets.top,      // This pushes content down below status bar
                    insets.right,
                    insets.bottom    // This pushes content up above navigation bar
                );

                System.out.println("✅ Applied window insets - Top: " + insets.top + "px");

                return WindowInsetsCompat.CONSUMED;
            });
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

            System.out.println("✅ WebView persistence configured: Database=" + webSettings.getDatabaseEnabled()
                + ", DOMStorage=" + webSettings.getDomStorageEnabled()
                + ", Cookies=" + cookieManager.acceptCookie());
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
