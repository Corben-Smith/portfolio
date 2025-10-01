precision highp float;
uniform sampler2D u_state;
varying vec2 vUv;
uniform vec2 u_resolution;
uniform vec3 u_coldColor;
uniform vec3 u_warmColor;

void main() {
    vec2 uv = gl_PointCoord - 0.5;
    vec4 state = texture2D(u_state, vUv);

    // Extract velocity from zw components
    vec2 vel = state.zw;
    float speed = length(vel);

    // Normalize speed to a reasonable range (adjust multiplier as needed)
    float speedNormalized = clamp(speed * 1.0, 0.01, .999);

    vec3 color = mix(u_coldColor, u_warmColor, speedNormalized);

    // Circular particle shape with vignette
    float dist = length(uv);
    float vignette = smoothstep(0.4, 0.0, dist);

    // Fade out particles with low velocity
    float alphaFromSpeed = smoothstep(0.0, .001, speedNormalized);
    float alpha = vignette * alphaFromSpeed;

    gl_FragColor = vec4(color, alphaFromSpeed);
}
