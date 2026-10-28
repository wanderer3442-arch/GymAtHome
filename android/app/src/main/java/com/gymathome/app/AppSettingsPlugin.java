package com.gymathome.app;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Opens this app's page in Android Settings.
 *
 * Android hard-blocks permission dialogs after the user denies a permission
 * ("Don't allow" / "Don't ask again"): any further requestPermission() call is
 * silently declined by the OS. System Settings is the only place such a
 * permission can be re-enabled, and WebView code has no way to deep-link there
 * without a native intent — hence this tiny plugin.
 */
@CapacitorPlugin(name = "AppSettings")
public class AppSettingsPlugin extends Plugin {

    @PluginMethod
    public void open(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getActivity().startActivity(intent);
        call.resolve();
    }
}
