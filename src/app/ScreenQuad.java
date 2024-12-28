package app;

import lwjglutils.OGLBuffers;
import lwjglutils.ShaderUtils;
import lwjglutils.ToFloatArray;
import transforms.Vec3D;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

import static org.lwjgl.opengl.GL11.GL_QUADS;
import static org.lwjgl.opengl.GL20.*;

public class ScreenQuad extends Solid {

    private static int shaderProgram = -1;
    private static final Set<String> SHADER_UNIFORM_NAMES = Set.of(
            "resolution", "viewMatrix", "viewPosition", "recursionLevel", "distanceEstimator", "fancierColors",
            "repeatX", "repeatY", "repeatZ"
    );
    private static final Map<String, Integer> shaderUniforms = new HashMap<>();

    private int width, height;
    private Vec3D viewPosition = new Vec3D();
    private DistanceEstimator distanceEstimator;
    private boolean fancierColors, repeatX, repeatY, repeatZ;

    public ScreenQuad() {
        this.topology = GL_QUADS;
        float[] vb = {
            -1, -1,
            -1, 1,
            1, 1,
            1, -1
        };
        int[] ib = {0, 1, 2, 3};

        OGLBuffers.Attrib[] attribs = {
                new OGLBuffers.Attrib("inPosition", 2),
        };

        this.distanceEstimator = DistanceEstimator.CUBE;
        this.buffers = new OGLBuffers(vb, attribs, ib);
        if (shaderProgram == -1) {
            shaderProgram = ShaderUtils.loadProgram("/shaders/raymarch");
            loadShaderUniforms();
        }
    }

    private void loadShaderUniforms() {
        for (String name : SHADER_UNIFORM_NAMES) {
            shaderUniforms.put(name, glGetUniformLocation(shaderProgram, name));
        }
    }

    private void setShaderUniforms() {
        float[] fViewMatrix = viewMatrix.floatArray();
        float[] fViewPosition = ToFloatArray.convert(viewPosition);

        glUniform2f(shaderUniforms.get("resolution"), width, height);
        glUniformMatrix4fv(shaderUniforms.get("viewMatrix"), true, fViewMatrix);
        glUniform3fv(shaderUniforms.get("viewPosition"), fViewPosition);
        glUniform1i(shaderUniforms.get("recursionLevel"), 3);
        glUniform1i(shaderUniforms.get("distanceEstimator"), distanceEstimator.ordinal());
        glUniform1i(shaderUniforms.get("fancierColors"), fancierColors ? 1 : 0);
        glUniform1i(shaderUniforms.get("repeatX"), repeatX ? 1 : 0);
        glUniform1i(shaderUniforms.get("repeatY"), repeatY ? 1 : 0);
        glUniform1i(shaderUniforms.get("repeatZ"), repeatZ ? 1 : 0);
    }

    @Override
    public void draw() {
        glUseProgram(shaderProgram);
        setShaderUniforms();
        buffers.draw(topology, shaderProgram);
    }

    public void setResolution(int width, int height) {
        this.width = width;
        this.height = height;
    }

    public void setViewPosition(Vec3D viewPosition) {
        this.viewPosition = viewPosition;
    }

    public void setDistanceEstimator(DistanceEstimator distanceEstimator) {
        this.distanceEstimator = distanceEstimator;
    }

    public void setFancierColors(boolean fancierColors) {
        this.fancierColors = fancierColors;
    }

    public void setRepeatX(boolean repeatX) {
        this.repeatX = repeatX;
    }

    public void setRepeatY(boolean repeatY) {
        this.repeatY = repeatY;
    }

    public void setRepeatZ(boolean repeatZ) {
        this.repeatZ = repeatZ;
    }
}
