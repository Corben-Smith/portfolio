uniform sampler2D u_state;
uniform vec2 u_resolution;
uniform float u_actorCount;
uniform float u_pointSize;

attribute float a_index;

varying vec2 vUv;

void main() {
    vec2 uv = vec2((a_index + 0.5) / u_actorCount, 0.5);
		vUv = uv;
    
    vec4 state = texture2D(u_state, uv);
    vec2 position = state.xy;

		gl_Position = vec4(position, 0.0, 1.0);

    gl_PointSize = u_pointSize;
}
