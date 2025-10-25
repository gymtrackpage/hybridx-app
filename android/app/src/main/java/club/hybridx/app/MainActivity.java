package club.hybridx.app;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.CookieManager;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Disable edge-to-edge to prevent content from rendering behind status bar
        // This ensures the hamburger menu and other UI elements are accessible
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);

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
            webSettings.setAppCacheEnabled(true);

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
    protected void onPause() {
        super.onPause();
        // Ensure cookies are saved when app goes to background
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().flush();
        }
    }
}
