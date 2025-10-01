uniform sampler2D u_prevState;
uniform vec2 u_screenResolution;
uniform float u_deltaTime;
uniform vec3 u_mouse;
uniform vec3 u_mousePrev;
uniform float u_influence;
uniform float u_range;
uniform float u_count;

uniform float u_pointSize;

varying vec2 vUv;

void main() {
		float u_push = .00001;
		vec4 prev = texture2D(u_prevState, vUv);
		vec2 pos = prev.xy;
		vec2 vel = prev.zw;

		vec2 aspect = vec2(u_screenResolution.x / u_screenResolution.y, 1.0);


		float i = gl_FragCoord.x;
		vec2 force = vec2(0.0);
		for (float j = 0.0; j < u_count; j += 1.0) {
				if (j == i) continue;

				vec2 uv_j = vec2((j + 0.5) / u_count, 0.5);

				vec4 other = texture2D(u_prevState, uv_j);
				vec2 dir = other.xy - pos;
				dir *= aspect;
				float dist = length(dir);
				if(dist > u_pointSize * .01){
					continue;
				}

				force += -dir;
		}
		

		vel += force;

		vec2 toMouse = u_mouse.xy - pos;
    vec2 toMouse_corrected = toMouse * aspect;
    float mouseDistance = length(toMouse_corrected);
    
		if(
				(((u_mouse.z == 0. || u_mouse.z == 1.) && mouseDistance < u_range) 
				|| ((u_mouse.z == 2. || u_mouse.z == 3.) && mouseDistance < u_range * 3.))
				&& mouseDistance > 0.001) {

        vec2 mouseVel = (u_mouse.xy - u_mousePrev.xy) / u_deltaTime;
        
				float falloff = 0.;
				if(u_mouse.z == 2. || u_mouse.z == 3.){
					falloff = 1.0 - smoothstep(0.0, u_range * 3., mouseDistance);
				}else{
					falloff = 1.0 - smoothstep(0.0, u_range, mouseDistance);
				}

        falloff = falloff * falloff;
        
        vec2 perpendicular = vec2(-toMouse.y, toMouse.x);
        vec2 swirl = normalize(perpendicular) * length(mouseVel) * 0.3;
        
        vec2 push = normalize(toMouse) * -1.0;
        
        vec2 drag = mouseVel * 0.5;

				vec2 mouseForce = vec2(0.,0.);

				if(u_mouse.z == 1. || u_mouse.z == 3.){
					mouseForce = ( drag + swirl * .5) * falloff;
					mouseForce += toMouse.xy * 10.;
				}else if(u_mouse.z == 2.){
					mouseForce = ( push + drag + swirl ) * falloff;
				}
				else{
					mouseForce = ( drag + swirl ) * falloff;
				}
        
        vel += mouseForce ;
    }


		vel *= .95;

		// vel.y += -.005;

		// Bounce at NDC bounds

		// POS = mod(pos, 1.0);
		pos.x = mod((pos.x + 1.), 2.) - 1.;
		pos.y = mod((pos.y + 1.), 2.) - 1.;


		// if (pos.x > 1.0) { pos.x = 1.0; vel.x *= -.9; }
		// if (pos.x < -1.0){ pos.x = -1.0; vel.x *= -.9; }
		// if (pos.y > 1.0) { pos.y = 1.0; vel.y *= -.9; }
		// if (pos.y < -1.0){ pos.y = -1.0; vel.y *= -.9; }
    //
		// pos = clamp(pos, -1., 1.);

		pos += (vel * u_deltaTime) / aspect;

		// if(u_mouse.z == 2. && d < u_range){
		// }

		// if(u_mouse.z == 1. && d < u_range){
		//   vec2 ov = u_mouse.xy - pos;
    //
		//   vec2 nd = normalize(ov);
    //
		//   vel = vel + nd * u_influence;
		// }
    //
		// if(u_mouse.z == 3. && d < u_range && d > u_range/2.){
		//   vec2 ov = u_mouse.xy - pos;
    //
		//   vec2 nd = normalize(ov);
    //
		//   vel = vel + nd * u_influence;
		// }

		gl_FragColor = vec4(pos, vel);
}
