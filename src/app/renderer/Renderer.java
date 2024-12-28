package app.renderer;

import app.enums.DistanceEstimator;
import app.geometry.ScreenQuad;
import lwjglutils.OGLTextRenderer;
import org.lwjgl.BufferUtils;
import org.lwjgl.glfw.*;
import transforms.Camera;
import transforms.Vec3D;

import java.nio.DoubleBuffer;

import static org.lwjgl.glfw.GLFW.glfwGetCursorPos;
import static org.lwjgl.opengl.GL11.*;
import static org.lwjgl.opengl.GL11.GL_DEPTH_BUFFER_BIT;

public class Renderer extends AbstractRenderer {

    private final Vec3D origin = new Vec3D(0, 0, 0);
    private Camera camera = new Camera().backward(3);
    private ScreenQuad screenQuad;
    private boolean isMousePressed = false;
    private final double[] mouseOrigin = new double[2];
    private DistanceEstimator distanceEstimator;
    private boolean fancierColors, repeatX, repeatY, repeatZ;

    @Override
    public void init() {
        screenQuad = new ScreenQuad();
        textRenderer = new OGLTextRenderer(width, height);

        distanceEstimator = DistanceEstimator.SPHERE;

        glClearColor(0, 0, 0, 1);
        glDisable(GL_CULL_FACE);
    }

    public void updateScreenQuad() {
        screenQuad.setResolution(width, height);
        screenQuad.setViewMatrix(camera.withPosition(origin).getViewMatrix());
        screenQuad.setViewPosition(camera.getPosition());
        screenQuad.setDistanceEstimator(distanceEstimator);
        screenQuad.setFancierColors(fancierColors);
        screenQuad.setRepeatX(repeatX);
        screenQuad.setRepeatY(repeatY);
        screenQuad.setRepeatZ(repeatZ);
    }

    @Override
    public void display() {
        glViewport(0, 0, width, height);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT); // clear the framebuffer

        updateScreenQuad();
        screenQuad.draw();

        drawText();
    }

    private void drawText() {
        textRenderer.addStr2D(width - 200, height - 10, "Raymarching, Jiří Bleha, PGRF3");
    }

    private void onKey(int key) {
        switch (key) {
            case GLFW.GLFW_KEY_F -> distanceEstimator = DistanceEstimator.values()[(distanceEstimator.ordinal() + 1)%DistanceEstimator.values().length];
            case GLFW.GLFW_KEY_C -> fancierColors = !fancierColors;
            case GLFW.GLFW_KEY_X -> repeatX = !repeatX;
            case GLFW.GLFW_KEY_Y -> repeatY = !repeatY;
            case GLFW.GLFW_KEY_Z -> repeatZ = !repeatZ;
        }
    }

    private void moveCamera(int key) {
        double speed = 0.02;
        switch (key) {
            case GLFW.GLFW_KEY_W -> camera = camera.forward(speed);
            case GLFW.GLFW_KEY_S -> camera = camera.backward(speed);
            case GLFW.GLFW_KEY_A -> camera = camera.left(speed);
            case GLFW.GLFW_KEY_D -> camera = camera.right(speed);
            case GLFW.GLFW_KEY_SPACE -> camera = camera.up(speed);
            case GLFW.GLFW_KEY_X -> camera = camera.down(speed);
        }
    }

    private void rotateCamera(double x, double y) {
        camera = camera.addAzimuth(Math.PI * (mouseOrigin[0] - x) / width)
                .addZenith(Math.PI * (mouseOrigin[1] - y) / height);
        mouseOrigin[0] = x;
        mouseOrigin[1] = y;
    }

    private final GLFWKeyCallback keyCallback = new GLFWKeyCallback() {
        @Override
        public void invoke(long window, int key, int scancode, int action, int mods) {
            if (action == GLFW.GLFW_PRESS) {
                onKey(key);
            }

            if (action == GLFW.GLFW_PRESS || action == GLFW.GLFW_REPEAT) {
                moveCamera(key);
            }
        }
    };

    @Override
    public GLFWKeyCallback getKeyCallback() {
        return keyCallback;
    }
    private final GLFWMouseButtonCallback mbCallback = new GLFWMouseButtonCallback() {

        @Override
        public void invoke(long window, int button, int action, int mods) {
            DoubleBuffer xBuffer = BufferUtils.createDoubleBuffer(1);
            DoubleBuffer yBuffer = BufferUtils.createDoubleBuffer(1);
            glfwGetCursorPos(window, xBuffer, yBuffer);
            double x = xBuffer.get(0);
            double y = yBuffer.get(0);

            if (button == GLFW.GLFW_MOUSE_BUTTON_1) {
                if (action == GLFW.GLFW_PRESS) {
                    isMousePressed = true;
                    mouseOrigin[0] = x;
                    mouseOrigin[1] = y;
                } else if (action == GLFW.GLFW_RELEASE) {
                    isMousePressed = false;
                    rotateCamera(x, y);
                }
            }
        }
    };

    @Override
    public GLFWMouseButtonCallback getMouseCallback() {
        return mbCallback;
    }

    private final GLFWCursorPosCallback cpCallbacknew = new GLFWCursorPosCallback() {
        @Override
        public void invoke(long window, double x, double y) {
            if (isMousePressed) rotateCamera(x, y);
        }
    };

    @Override
    public GLFWCursorPosCallback getCursorCallback() {
        return cpCallbacknew;
    }
    protected GLFWWindowSizeCallback wsCallback = new GLFWWindowSizeCallback() {
        @Override
        public void invoke(long window, int w, int h) {
            width = w;
            height = h;

            if (textRenderer != null) {
                textRenderer.resize(width, height);
            }
        }
    };

    @Override
    public GLFWWindowSizeCallback getWsCallback() {
        return wsCallback;
    }
}
