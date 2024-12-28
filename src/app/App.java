package app;

import app.renderer.Renderer;

public class App {
    public static void main(String[] args) {
        new LwjglWindow(new Renderer());
    }
}
