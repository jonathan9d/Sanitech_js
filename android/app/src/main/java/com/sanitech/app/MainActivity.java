package com.sanitech.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int REQ_CAMERA = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // La WebView (scanner QR + selfie de pointage) utilise getUserMedia :
        // la permission CAMERA doit être accordée au runtime pour que
        // Capacitor puisse transmettre le flux vidéo à l'application.
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{ Manifest.permission.CAMERA }, REQ_CAMERA);
        }
    }
}
