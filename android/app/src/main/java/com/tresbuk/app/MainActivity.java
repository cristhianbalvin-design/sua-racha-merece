package com.tresbuk.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /**
     * El tamaño de letra del sistema agrandaba todo el diseño (textos sobre ilustraciones y la barra
     * inferior tapando botones). Fijamos el zoom del WebView en 100 %: la app ya usa tamaños pensados
     * para teléfono.
     */
    @Override
    public void onStart() {
        super.onStart();
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setTextZoom(100);
        }
    }
}
