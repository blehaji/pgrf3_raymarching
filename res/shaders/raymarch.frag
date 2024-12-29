#version 330

uniform vec2 resolution;
uniform mat4 viewMatrix;
uniform vec3 viewPosition;
uniform int recursionLevel;
uniform int distanceEstimator;
uniform bool fancierColors;
uniform bool repeatX;
uniform bool repeatY;
uniform bool repeatZ;

in vec2 fragPos;

out vec4 outColor;

#define AMBIENT_OCCLUSION_STRENGTH 0.01
#define AMBIENT_OCCLUSION_COLOR_DELTA vec3(0.8,0.8,0.8)
#define BACKGROUND_COLOR vec3(0.4,0.6,0.9)
#define FIELD_OF_VIEW 60.0
#define GLOW_SHARPNESS 4.0
#define LIGHT_COLOR vec3(1.0,0.9,0.6)
#define LIGHT_DIRECTION vec3(-0.36,0.48,0.8)
#define LOD_MULTIPLIER 10.0
#define MAX_MARCHES 1000
#define MAX_DIST 50.0
#define MIN_DIST 1e-05
#define SHADOW_DARKNESS 0.8
#define SPECULAR_HIGHLIGHT 10
#define SUN_ENABLED 1
#define SUN_SIZE 0.005
#define SUN_SHARPNESS 2.0
#define VIGNETTE_FOREGROUND 0
#define VIGNETTE_STRENGTH 0.5

// distance estimator types
#define SPHERE 0
#define CUBE 1
#define MENGER_SPONGE 2
#define SIERPINKSI_TETRAHEDRON 3
#define MENGER_SIERPINSKI_SNOWFLAKE 4
#define MOSELY_SNOWFLAKE 5

const float FOCAL_DIST = 1.0 / tan(radians(180) * FIELD_OF_VIEW / 360.0);

//##########################################
//
//   Space folding functions
//
//##########################################
void planeFold(inout vec4 z, vec3 n, float d) {
    z.xyz -= 2.0 * min(0.0, dot(z.xyz, n) - d) * n;
}
void absFold(inout vec4 z, vec3 c) {
    z.xyz = abs(z.xyz - c) + c;
}
void sierpinskiFold(inout vec4 z) {
    z.xy -= min(z.x + z.y, 0.0);
    z.xz -= min(z.x + z.z, 0.0);
    z.yz -= min(z.y + z.z, 0.0);
}
void mengerFold(inout vec4 z) {
    float a = min(z.x - z.y, 0.0);
    z.x -= a;
    z.y += a;
    a = min(z.x - z.z, 0.0);
    z.x -= a;
    z.z += a;
    a = min(z.y - z.z, 0.0);
    z.y -= a;
    z.z += a;
}
void sphereFold(inout vec4 z, float minR, float maxR) {
    float r2 = dot(z.xyz, z.xyz);
    z *= max(maxR / max(minR, r2), 1.0);
}
void boxFold(inout vec4 z, vec3 r) {
    z.xyz = clamp(z.xyz, -r, r) * 2.0 - z.xyz;
}
void rotX(inout vec4 z, float s, float c) {
    z.yz = vec2(c*z.y + s*z.z, c*z.z - s*z.y);
}
void rotY(inout vec4 z, float s, float c) {
    z.xz = vec2(c*z.x - s*z.z, c*z.z + s*z.x);
}
void rotZ(inout vec4 z, float s, float c) {
    z.xy = vec2(c*z.x + s*z.y, c*z.y - s*z.x);
}
void rotX(inout vec4 z, float a) {
    rotX(z, sin(a), cos(a));
}
void rotY(inout vec4 z, float a) {
    rotY(z, sin(a), cos(a));
}
void rotZ(inout vec4 z, float a) {
    rotZ(z, sin(a), cos(a));
}

//##########################################
//
//   Primative distance estimators
//
//##########################################
float de_sphere(vec4 p, float r) {
    return (length(p.xyz) - r) / p.w;
}
float de_box(vec4 p, vec3 s) {
    vec3 a = abs(p.xyz) - s;
    return (min(max(max(a.x, a.y), a.z), 0.0) + length(max(a, 0.0))) / p.w;
}
float de_tetrahedron(vec4 p, float r) {
    float md = max(max(-p.x - p.y - p.z, p.x + p.y - p.z),
    max(-p.x + p.y + p.z, p.x - p.y + p.z));
    return (md - r) / (p.w * sqrt(3.0));
}
float de_inf_cross(vec4 p, float r) {
    vec3 q = p.xyz * p.xyz;
    return (sqrt(min(min(q.x + q.y, q.x + q.z), q.y + q.z)) - r) / p.w;
}
float de_inf_cross_xy(vec4 p, float r) {
    vec3 q = p.xyz * p.xyz;
    return (sqrt(min(q.x, q.y) + q.z) - r) / p.w;
}
float de_inf_line(vec4 p, vec3 n, float r) {
    return (length(p.xyz - n*dot(p.xyz, n)) - r) / p.w;
}


//##########################################
//
//   Fractal space folding functions
//
//##########################################

void fold_merger_sponge(inout vec4 p) {
    for (int i = 0; i < recursionLevel; ++i) {
        p.xyz = abs(p.xyz);
        mengerFold(p);
        p *= 3;
        p.xyz -= vec3(1.0, 1.0, 0.0);
        p.z = .5 - abs(p.z - .5);
    }
}

void fold_sierpinski_tetrahedron(inout vec4 p) {
    for (int i = 0; i < recursionLevel; ++i) {
        sierpinskiFold(p);
        p *= 2;
        p.xyz -= vec3(.5, .5, .5);
    }
}

void fold_menger_sierpinski_snowflake(inout vec4 p) {
    for (int i = 0; i < recursionLevel; ++i) {
        p.xyz = abs(p.xyz);
        mengerFold(p);
        p *= 3;
        p.xyz -= vec3(1.0);
    }
}

void fold_mosely_snowflake(inout vec4 p) {
    for (int i = 0; i < recursionLevel; ++i) {
        p.xyz = abs(p.xyz);
        mengerFold(p);
        p *= 3;
        p.xyz -= vec3(1, 0.0, 0.0);
        p.y = .5 - abs(p.y - .5);
    }
}

//##########################################
//
//   Fractal distance estimators
//
//##########################################

float de_menger_sponge(vec4 p) {
    float d = 1e20;
    fold_merger_sponge(p);
    d = min(d, de_box(p, vec3(.5)));
    return d;
}

float de_sierpinski_tetrahedron(vec4 p) {
    float d = 1e20;
    fold_sierpinski_tetrahedron(p);
    d = min(d, de_tetrahedron(p, .5));
    return d;
}

float de_menger_sierpinski_snowflake(vec4 p) {
    float d = 1e20;
    fold_menger_sierpinski_snowflake(p);
    d = min(d, de_box(p, vec3(.5)));
    return d;
}

float de_mosely_snowfalke(vec4 p) {
    float d = 1e20;
    fold_mosely_snowflake(p);
    d = min(d, de_box(p, vec3(.5)));
    return d;
}

float fractal_de(vec4 p) {
    // repeating
    if (repeatX) p.x = sin(p.x);
    if (repeatY) p.y = sin(p.y);
    if (repeatZ) p.z = sin(p.z);

    switch (distanceEstimator) {
        case SPHERE:
        return de_sphere(p, .5);
        case CUBE:
        return de_box(p, vec3(.5));
        case MENGER_SPONGE:
        return de_menger_sponge(p);
        case SIERPINKSI_TETRAHEDRON:
        return de_sierpinski_tetrahedron(p);
        case MENGER_SIERPINSKI_SNOWFLAKE:
        return de_menger_sierpinski_snowflake(p);
        case MOSELY_SNOWFLAKE:
        return de_mosely_snowfalke(p);
    }
    return MAX_DIST;
}


//##########################################
//
//   Fractal color functions
//
//##########################################
vec4 col_menger_sponge(vec4 p) {
    fold_merger_sponge(p);
    return (vec4(10)*p)*vec4(0.4,0.1,0.7,1);
}

vec4 col_sierpinksi_tetrahedron(vec4 p) {
    fold_sierpinski_tetrahedron(p);
    return max(p*vec4(10), vec4(0.6))*vec4(0.8,0,1,1);
}

vec4 col_menger_sierpinski_snowflake(vec4 p) {
    fold_menger_sierpinski_snowflake(p);
    return (vec4(10)*p)*vec4(0.4,0.1,0.7,1);
}

vec4 col_mosely_snowflake(vec4 p) {
    fold_mosely_snowflake(p);
    return (vec4(10)*p)*vec4(0.4,0.1,0.7,1);
}

vec4 fractal_col(vec4 p) {
    // repeating
    if (repeatX) p.x = sin(p.x);
    if (repeatY) p.y = sin(p.y);
    if (repeatZ) p.z = sin(p.z);

    // static color
    if (!fancierColors) {
        return vec4(0.8, 0, 1, 1);
    }

    // calculate color based on space folding functions
    switch (distanceEstimator) {
        case CUBE:
        return (vec4(10)*p)*vec4(0.4,0.1,0.7,1);
        case SPHERE:
        return max(p*vec4(10), vec4(0.6))*vec4(0.8,0,1,1);
        case MENGER_SPONGE:
        return col_menger_sponge(p);
        case SIERPINKSI_TETRAHEDRON:
        return col_sierpinksi_tetrahedron(p);
        case MENGER_SIERPINSKI_SNOWFLAKE:
        return col_menger_sierpinski_snowflake(p);
        case MOSELY_SNOWFLAKE:
        return col_mosely_snowflake(p);
    }
    return vec4(BACKGROUND_COLOR, 1);
}

//##########################################
//
//   Main code
//
//##########################################
vec4 ray_march(inout vec4 p, vec4 ray, float sharpness, float td) {
    //March the ray
    float d = MIN_DIST;
    float s = 0.0;
    float min_d = 1.0;
    for (; s < MAX_MARCHES; s += 1.0) {
        d = fractal_de(p);
        if (d < MIN_DIST) {
            s += d / MIN_DIST;
            break;
        } else if (td > MAX_DIST) {
            break;
        }
        td += d;
        p += ray * d;
        min_d = min(min_d, sharpness * d / td);
    }
    return vec4(d, s, td, min_d);
}
vec4 ray_march(inout vec4 p, vec3 ray, float sharpness, float td) {
    return ray_march(p, vec4(ray, 0.0), sharpness, td);
}

//Normal calculation formula from http://www.iquilezles.org/www/articles/normalsSDF/normalsSDF.htm
vec3 calcNormal(vec4 p, float dx) {
    const vec3 k = vec3(1,-1,0);
    return normalize(k.xyy*fractal_de(p + k.xyyz*dx) +
    k.yyx*fractal_de(p + k.yyxz*dx) +
    k.yxy*fractal_de(p + k.yxyz*dx) +
    k.xxx*fractal_de(p + k.xxxz*dx));
}

vec4 scene(inout vec4 origin, inout vec4 ray, float vignette, float td) {
    //Trace the ray
    vec4 p = origin;
    vec4 d_s_td_m = ray_march(p, ray, GLOW_SHARPNESS, td);
    float d = d_s_td_m.x;
    float s = d_s_td_m.y;
    td = d_s_td_m.z;
    float m = d_s_td_m.w;

    //Determine the color for this pixel
    vec3 col = vec3(0.0);
    float min_dist = MIN_DIST * max(td * LOD_MULTIPLIER, 1.0);
    if (d < min_dist) {
        //Get the surface normal
        vec3 n = calcNormal(p, MIN_DIST * 10);
        vec3 reflected = ray.xyz - 2.0*dot(ray.xyz, n) * n;

        //Get coloring
        vec3 orig_col = clamp(fractal_col(p).xyz, 0.0, 1.0);

        float k = 1.0;

        //Get specular
        #if SPECULAR_HIGHLIGHT > 0
        float specular = max(dot(reflected, LIGHT_DIRECTION), 0.0);
        specular = pow(specular, SPECULAR_HIGHLIGHT);
        col += specular * LIGHT_COLOR * k;
        #endif

        //Get diffuse lighting
        k = min(k, dot(n, LIGHT_DIRECTION));

        //Ambient lighting
        k = max(k, 1.0 - SHADOW_DARKNESS);
        col += orig_col * LIGHT_COLOR * k;

        //Add small amount of ambient occlusion
        float a = 1.0 / (1.0 + s * AMBIENT_OCCLUSION_STRENGTH);
        col += (1.0 - a) * AMBIENT_OCCLUSION_COLOR_DELTA;

        //Set up the reflection
        origin = p + vec4(n * min_dist * 100, 0.0);
        ray = vec4(reflected, 0.0);

        //Apply vignette if needed
        #if VIGNETTE_FOREGROUND
        col *= vignette;
        #endif
    } else {
        //Ray missed, start with solid background color
        col += BACKGROUND_COLOR;

        col *= vignette;
        //Background specular
        #if SUN_ENABLED
        float sun_spec = dot(ray.xyz, LIGHT_DIRECTION) - 1.0 + SUN_SIZE;
        sun_spec = min(exp(sun_spec * SUN_SHARPNESS / SUN_SIZE), 1.0);
        col += LIGHT_COLOR * sun_spec;
        #endif
    }
    return vec4(col, td);
}

void main() {
    vec4 col = vec4(0.0);

    mat4 mat = viewMatrix;

    //Get normalized screen coordinate
    vec2 uv = fragPos;
    uv.x *= resolution.x / resolution.y;
    vec2 screen_pos = (uv + 1)/2;

    vec4 ray = normalize(vec4(uv.x, uv.y, -FOCAL_DIST, 0.0));
    ray = mat * normalize(ray);

    vec4 p = vec4(viewPosition, 1);

    float vignette = 1.0 - VIGNETTE_STRENGTH * length(screen_pos - 0.5);
    col += scene(p, ray, vignette, 0.0);

    outColor.xyz = clamp(col.xyz, 0.0, 1.0);
    outColor.w = min(col.w / MAX_DIST, 0.999);
}
