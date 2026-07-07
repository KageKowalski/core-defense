## GameCamera
## Orthographic camera at 45° azimuth / 60° elevation providing an isometric-style
## view of the 20×20 grid. Replaces Three.js camera setup.
extends Camera3D


func _ready() -> void:
	projection = Camera3D.PROJECTION_ORTHOGONAL
	size = max(GameConfig.GRID_WIDTH, GameConfig.GRID_HEIGHT) * 1.2

	var azimuth := deg_to_rad(GameConfig.CAMERA_AZIMUTH)
	var elevation := deg_to_rad(GameConfig.CAMERA_ELEVATION)
	var cam_distance := 30.0

	var center := Vector3(GameConfig.GRID_WIDTH / 2.0, 0, GameConfig.GRID_HEIGHT / 2.0)
	position = Vector3(
		cos(elevation) * sin(azimuth) * cam_distance + center.x,
		sin(elevation) * cam_distance,
		cos(elevation) * cos(azimuth) * cam_distance + center.z
	)
	look_at(center)
