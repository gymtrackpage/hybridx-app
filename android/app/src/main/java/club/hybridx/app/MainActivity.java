
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
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // --- Definitive Edge-to-Edge Fix ---
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // Make status bar and navigation bar transparent
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(Color.TRANSPARENT);
            getWindow().setNavigationBarColor(Color.TRANSPARENT);
        }

        // Set status bar icons to light (for dark backgrounds) or dark (for light backgrounds)
        WindowInsetsControllerCompat windowInsetsController =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (windowInsetsController != null) {
            // Use light icons for dark status bar in dark mode
            // Use dark icons for light status bar in light mode
            // This can be adapted based on web app's theme via CSS `prefers-color-scheme`
            // For now, let's assume a light header by default
            windowInsetsController.setAppearanceLightStatusBars(true);
            windowInsetsController.setAppearanceLightNavigationBars(true); // Assuming light nav bar
        }
        // --- End of Fix ---


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
