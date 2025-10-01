import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export async function initShader(elementId) {
	//get element, width, height
	const element = document.getElementById(elementId);
	let screen_width = element.clientWidth;
	let screen_height = element.clientHeight;


	//create renderer, set size, append to dom
	const renderer = new THREE.WebGLRenderer();
	renderer.setSize(screen_width, screen_height);
	renderer.setPixelRatio(window.devicePixelRatio);
	// renderer.setAnimationLoop( animate );

	element.appendChild(renderer.domElement);

	const gl = renderer.getContext();
	const floatExtension = gl.getExtension('OES_texture_float') || gl.getExtension('EXT_color_buffer_float');
	if (!floatExtension) {
		console.error('Float textures not supported');
		return;
	}

	//get our shaders from endpoint
	const vertexUrl = "./shaders/vertex.glsl";
	const fragmentUrl = "./shaders/displayFragment.glsl";
	const computeUrl = "./shaders/computeFragment.glsl";


	const vertexShader = await loadShader(vertexUrl);
	const fragmentShader = await loadShader(fragmentUrl);
	const computeFragmentShader = await loadShader(computeUrl);

	let mouseCurrent = new THREE.Vector3(0, 0, 0);
	let mousePrev = new THREE.Vector3(0, 0, 0);

	//now i need to create everything to be rendered
	//I need a display scene, and a compute scene
	//The display scene uses points to display the particles
	//the display vertex shader gets passed state via uniform u_state
	//the compute shader renders to a texture and that texture contains state
	//ping pong buffer
	//animation loop


	// const actor_count = 8000;
	// const point_size = 3;
	const { actor_count, point_size } = getActorCountAndPointSize();

	const rtOptions = {
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		format: THREE.RGBAFormat,
		type: THREE.FloatType,
		generateMipmaps: false,
		wrapS: THREE.RepeatWrapping,
		wrapT: THREE.RepeatWrapping,
	};

	const rtA = new THREE.WebGLRenderTarget(actor_count, 1, rtOptions);
	const rtB = new THREE.WebGLRenderTarget(actor_count, 1, rtOptions);


	const data = new Float32Array(actor_count * 4);

	for (let i = 0; i < actor_count; i++) {
		const px = Math.random() * 2 - 1;
		const py = Math.random() * 2 - 1;

		// const vx = (Math.random() - 0.5) * 0.2;
		const vx = randFloat(-.05, .05);
		const vy = randFloat(-.05, .05);

		data[i * 4 + 0] = px;
		data[i * 4 + 1] = py;
		data[i * 4 + 2] = vx;
		data[i * 4 + 3] = vy;
	}

	console.log(point_size);
	console.log(actor_count);
	const stateTex = new THREE.DataTexture(
		data,
		actor_count,
		1,
		THREE.RGBAFormat,
		THREE.FloatType
	);

	stateTex.needsUpdate = true;
	stateTex.minFilter = THREE.NearestFilter;
	stateTex.magFilter = THREE.NearestFilter;
	stateTex.wrapS = THREE.ClampToEdgeWrapping;
	stateTex.wrapT = THREE.ClampToEdgeWrapping;

	renderer.setRenderTarget(rtA);
	renderer.copyTextureToTexture(
		new THREE.Vector2(0, 0),
		stateTex,
		rtA.texture
	);

	renderer.setRenderTarget(rtB);
	renderer.copyTextureToTexture(
		new THREE.Vector2(0, 0),
		stateTex,
		rtB.texture
	);

	renderer.setRenderTarget(null);


	const computeVertexShader = `
	// attribute vec3 position;
	// attribute vec2 uv;
	varying vec2 vUv;

	void main() {
			vUv = uv;
			gl_Position = vec4(position, 1.0);
	}
	`;

	const compute_mat = new THREE.ShaderMaterial({
		vertexShader: computeVertexShader,
		fragmentShader: computeFragmentShader,
		uniforms: {
			u_prevState: { value: rtA.texture },
			u_screenResolution: { value: new THREE.Vector2(screen_width, screen_height) },
			u_deltaTime: { value: 0.016 },
			u_mouse: { value: new THREE.Vector3(0, 0, 0) },
			u_mousePrev: { value: new THREE.Vector3(0, 0, 0) },
			u_influence: { value: .5 },
			u_range: { value: 0.15 },
			u_count: { value: actor_count },
			u_pointSize: { value: point_size },
		}
	});

	const compute_geometry = new THREE.PlaneGeometry(2, 2);
	const compute_mesh = new THREE.Mesh(compute_geometry, compute_mat);
	const compute_scene = new THREE.Scene();
	compute_scene.add(compute_mesh);

	// const compute_camera = new THREE.OrthographicCamera(0.0, actor_count, -0.5, 0.5, 0.1, 10);
	const compute_camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	compute_camera.position.z = 1;


	const buffer_geometry = new THREE.BufferGeometry();

	const indices = new Float32Array(actor_count);
	for (let i = 0; i < actor_count; i++) {
		indices[i] = i;  // Each particle gets its ID
	}
	buffer_geometry.setAttribute('a_index', new THREE.BufferAttribute(indices, 1));

	const vertices = new Float32Array(actor_count * 3);
	for (let i = 0; i < actor_count * 3; i++) {
		vertices[i] = 0.0;
	}
	buffer_geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

	let coldColor = new THREE.Vector3(0., 0., 0.);
	let warmColor = new THREE.Vector3(1., 0.5, 1.);

	const point_mat = new THREE.ShaderMaterial({
		vertexShader: vertexShader,
		fragmentShader: `
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
		`,
		uniforms: {
			u_state: { value: rtB.texture },
			u_actorCount: { value: actor_count },
			u_pointSize: { value: point_size },
			u_resolution: { value: new THREE.Vector2(screen_width, screen_height) },
			u_coldColor: { value: coldColor },
			u_warmColor: { value: warmColor }
		}
	});

	const particles_mesh = new THREE.Points(buffer_geometry, point_mat);
	const display_scene = new THREE.Scene();
	display_scene.add(particles_mesh);

	// const display_camera = new THREE.OrthographicCamera(
	//     0,      // left
	//     screen_width,  // right
	//     0,      // top
	//     screen_height, // bottom
	//     0.1,    // near
	//     10      // far
	// );

	const display_camera = new THREE.OrthographicCamera(
		-1,   // left
		1,    // right
		1,   // top
		-1,  // bottom
		0.1,               // near
		5000               // far
	);

	display_camera.position.z = 1;

	// display_camera.position.set(0, 0, 2000);
	let rtP = rtA;
	let rtC = rtB;


	// compute_mat.uniforms.u_prevState.value = rtP.texture;
	// renderer.setRenderTarget(rtC);
	// renderer.render(compute_scene, compute_camera);
	//
	// point_mat.uniforms.u_state.value = rtC.texture;
	// renderer.setRenderTarget(null);
	// renderer.clear();

	// renderer.render(display_scene, display_camera);
	// renderer.render(init_scene, initCamera);

	const clock = new THREE.Clock();

	let frame = 0;
	function animate() {
		const t = clock.getElapsedTime();
		const dt = Math.max(clock.getDelta(), 0.016); // Cap at 60fps
		// const dt = clock.getDelta(); // Cap at 60fps


		compute_mat.uniforms.u_mousePrev.value.copy(mousePrev);
		compute_mat.uniforms.u_mouse.value.copy(mouseCurrent);
		compute_mat.uniforms.u_prevState.value = rtP.texture;
		compute_mat.uniforms.u_deltaTime.value = dt;

		renderer.setRenderTarget(rtC);
		renderer.render(compute_scene, compute_camera);

		point_mat.uniforms.u_state.value = rtC.texture;
		renderer.setRenderTarget(null);

		// display_material.uniforms.u_time.value = t;
		// display_material.uniforms.u_deltaTime.value = dt;

		renderer.render(display_scene, display_camera);

		mousePrev.copy(mouseCurrent);

		frame += 1;
		// console.log(frame / t);

		[rtC, rtP] = [rtP, rtC];
		requestAnimationFrame(animate);
	}

	animate();


	// Resize handling
	new ResizeObserver(() => {
		const newscreen_width = element.clientWidth;
		const newscreen_height = element.clientHeight;

		if (newscreen_width === screen_width && newscreen_height === newscreen_height) return; // Skip if no change

		screen_width = newscreen_width;
		screen_height = newscreen_height;

		point_mat.uniforms.u_resolution.value = new THREE.Vector2(screen_width, screen_height);

		compute_mat.uniforms.u_screenResolution.value = new THREE.Vector2(screen_width, screen_height);

		renderer.setSize(screen_width, screen_height);
		// displayShader.resize(width, height);
	}).observe(element);

	let leftPressed = false;
	let rightPressed = false;

	// let mouseCurrent = new THREE.Vector3(0,0,0);
	// let mousePrev = new THREE.Vector3(0,0,0);

	element.addEventListener("mousedown", e => {
		if (e.button === 0) leftPressed = true;   // Left button
		if (e.button === 2) rightPressed = true;  // Right button

		let z = 0;
		if (leftPressed && rightPressed) z = 3;
		else if (rightPressed) z = 2;
		else if (leftPressed) z = 1;

		updateMouse(mouseCurrent.x, mouseCurrent.y, z);
		console.log(z);
	});

	element.addEventListener("mouseup", e => {
		if (e.button === 0) leftPressed = false;  // Left button
		if (e.button === 2) rightPressed = false; // Right button

		let z = 0;
		if (leftPressed && rightPressed) z = 3;
		else if (rightPressed) z = 2;
		else if (leftPressed) z = 1;

		updateMouse(mouseCurrent.x, mouseCurrent.y, z);
	});


	function updateMouse(x, y, z) {
		mousePrev.copy(mouseCurrent);
		mouseCurrent.set(x, y, z);

		compute_mat.uniforms.u_mousePrev.value = mousePrev.clone();
		compute_mat.uniforms.u_mouse.value = mouseCurrent.clone();
	}

	element.addEventListener("contextmenu", (e) => {
		e.preventDefault();
	});

	// --- Mouse events ---
	element.addEventListener("mousemove", e => {
		const rect = element.getBoundingClientRect();
		const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
		const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

		let z = 0;
		if (leftPressed && rightPressed) z = 3;
		else if (rightPressed) z = 2;
		else if (leftPressed) z = 1;

		updateMouse(x, y, z);
	});

	// --- Touch events ---
	element.addEventListener("touchstart", e => {
		leftPressed = true; // treat as left mouse down
		const rect = element.getBoundingClientRect();
		const touch = e.touches[0];
		const x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
		const y = -(((touch.clientY - rect.top) / rect.height) * 2 - 1);

		updateMouse(x, y, 1);
	});

	element.addEventListener("touchmove", e => {
		const rect = element.getBoundingClientRect();
		const touch = e.touches[0];
		const x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
		const y = -(((touch.clientY - rect.top) / rect.height) * 2 - 1);

		updateMouse(x, y, 1);
	}, { passive: true });

	element.addEventListener("touchend", e => {
		leftPressed = false; // reset like mouseup
		updateMouse(mouseCurrent.x, mouseCurrent.y, 0);
	});

	let lightsOn = true;
	document.getElementById("toggleMode").addEventListener("click", () => {
		if (!lightsOn) {
			coldColor = new THREE.Vector3(0., 0., 0.);
			warmColor = new THREE.Vector3(1., 0.5, 1.);
		} else {
			coldColor = new THREE.Vector3(.25, .125, .5);
			warmColor = new THREE.Vector3(1., 0.5, 1.);
		}

		lightsOn = !lightsOn;
		point_mat.uniforms.u_coldColor.value = coldColor;
		point_mat.uniforms.u_warmColor.value = warmColor;
	});
}

function loadShader(url) {
	return new Promise((resolve, reject) => {
		const loader = new THREE.FileLoader();
		loader.setResponseType('text');
		loader.load(url, data => resolve(data), undefined, err => reject(err));
	});

}

function randFloat(min, max) {
	return Math.random() * (max - min) + min;
}

function getActorCountAndPointSize() {
	const width = window.innerWidth;
	const height = window.innerHeight;
	const area = width * height;

	// Define min/max area for scaling
	const minArea = 320 * 480;    // small phone
	const maxArea = 1920 * 1080;  // desktop

	// normalized factor 0 → 1
	const t = Math.min(Math.max((area - minArea) / (maxArea - minArea), 0), 1);

	// actor count: small screens → few, large screens → many
	const minCount = 800;
	const maxCount = 8000;
	const actor_count = Math.round(minCount + t * (maxCount - minCount));

	// point size: small screens → larger points, large screens → smaller points
	const minPoint = 3;  // min size on large screens
	const maxPoint = 5;  // max size on small screens
	const point_size = Math.round(maxPoint - t * (maxPoint - minPoint));

	console.log({ width, height, t, actor_count, point_size });

	return { actor_count, point_size };
}
