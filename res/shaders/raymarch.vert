#version 330

in vec2 inPosition;
out vec2 fragPos;

void main() {
    gl_Position = vec4(inPosition, 0, 1);
    fragPos = inPosition;
}
