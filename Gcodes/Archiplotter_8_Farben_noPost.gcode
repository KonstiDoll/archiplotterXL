; generated by PrusaSlicer 2.5.0+MacOS-arm64 on 2023-12-10 at 16:33:25 UTC

; 

; external perimeters extrusion width = 0.45mm
; perimeters extrusion width = 0.45mm
; infill extrusion width = 0.45mm
; solid infill extrusion width = 0.45mm
; top infill extrusion width = 0.40mm
; first layer extrusion width = 0.42mm

; external perimeters extrusion width = 0.45mm
; perimeters extrusion width = 0.45mm
; infill extrusion width = 0.45mm
; solid infill extrusion width = 0.45mm
; top infill extrusion width = 0.40mm
; first layer extrusion width = 0.42mm

; external perimeters extrusion width = 0.45mm
; perimeters extrusion width = 0.45mm
; infill extrusion width = 0.45mm
; solid infill extrusion width = 0.45mm
; top infill extrusion width = 0.40mm
; first layer extrusion width = 0.42mm

; external perimeters extrusion width = 0.45mm
; perimeters extrusion width = 0.45mm
; infill extrusion width = 0.45mm
; solid infill extrusion width = 0.45mm
; top infill extrusion width = 0.40mm
; first layer extrusion width = 0.42mm

; external perimeters extrusion width = 0.45mm
; perimeters extrusion width = 0.45mm
; infill extrusion width = 0.45mm
; solid infill extrusion width = 0.45mm
; top infill extrusion width = 0.40mm
; first layer extrusion width = 0.42mm

; external perimeters extrusion width = 0.45mm
; perimeters extrusion width = 0.45mm
; infill extrusion width = 0.45mm
; solid infill extrusion width = 0.45mm
; top infill extrusion width = 0.40mm
; first layer extrusion width = 0.42mm

; external perimeters extrusion width = 0.45mm
; perimeters extrusion width = 0.45mm
; infill extrusion width = 0.45mm
; solid infill extrusion width = 0.45mm
; top infill extrusion width = 0.40mm
; first layer extrusion width = 0.42mm

; external perimeters extrusion width = 0.45mm
; perimeters extrusion width = 0.45mm
; infill extrusion width = 0.45mm
; solid infill extrusion width = 0.45mm
; top infill extrusion width = 0.40mm
; first layer extrusion width = 0.42mm

M73 P0 R0
M107
G10 S200 P0 ; set temperature
;TYPE:Custom
;G28 ; home all axes
;G1 Z5 F5000 ; lift nozzle
;uValueUp=20
;uValueDown=5
G10 S200 P0 ; set temperature
M116 ; wait for temperature to be reached
G21 ; set units to millimeters
G90 ; use absolute coordinates
M82 ; use absolute distances for extrusion
G92 E0
T0
G92 E0
G10 S200 ; set temperature
M98 P"/macros/grab_tool_1"
G1 Z10
M107
;LAYER_CHANGE
;Z:0.4
;HEIGHT:0.4
G1 Z.4 F1800
M73 P1 R0
G1 E-2 F2400
G92 E0
G1 Z8.4 F1800
M73 P3 R0
G1 X110.697 Y324.761 F7800
M73 P8 R0
G1 Z.4 F1800
M73 P9 R0
G1 E2 F2400
;TYPE:External perimeter
;WIDTH:0.42
M73 P10 R0
G1 F6000
G1 X90.849 Y322.453 E153.13948
M73 P12 R0
G1 X101.978 Y226.731 E882.03415
M73 P24 R0
G1 X121.826 Y229.038 E1033.17196
M73 P27 R0
G1 X110.704 Y324.702 E1761.62653
G92 E0
M73 P39 R0
G1 Z8.4 F1800
M98 P"/macros/place_tool_1"
T1
G92 E0
G10 S200 ; set temperature
M98 P"/macros/grab_tool_2"
M73 P40 R0
G1 U11
G1 E-2 F2400
G92 E0
G1 X107.55 Y264.579 F7800
M73 P41 R0
G1 Z.4 F1800
M73 P43 R0
G1 E2 F2400
G1 F6000
G1 X106.34 Y274.265 E12.38218
G1 X105.529 Y274.118 E13.25822
G1 X105.033 Y273.988 E13.80419
G1 X104.542 Y273.831 E14.35243
G1 X104.06 Y273.647 E14.901
G1 X103.587 Y273.439 E15.45044
G1 X103.128 Y273.206 E15.99826
G1 X102.681 Y272.95 E16.54584
G1 X102.249 Y272.671 E17.09342
G1 X101.833 Y272.371 E17.63839
G1 X101.048 Y271.705 E18.73367
G1 X100.665 Y271.329 E19.30484
G1 X100.326 Y270.96 E19.83707
G1 X99.827 Y270.329 E20.69296
G1 X107.501 Y264.615 E30.87035
M73 P44 R0
G1 E20.87035 F2400
G92 E0
G1 Z8.4 F1800
M98 P"/macros/place_tool_2"
T2
G92 E0
G10 S200 ; set temperature
M98 P"/macros/grab_tool_3"
M73 P46 R0
G1 U11
G1 E-2 F2400
G92 E0
G1 X109.206 Y250.302 F7800
G1 Z.4 F1800
M73 P48 R0
G1 E2 F2400
G1 F6000
G1 X108.04 Y260.308 E12.71497
G1 X105.725 Y260.033 E15.19493
G1 X98.333 Y259.216 E23.10446
G1 X98.405 Y258.699 E23.65966
G1 X98.546 Y258.044 E24.37229
G1 X98.729 Y257.401 E25.08334
G1 X98.952 Y256.773 E25.7922
G1 X99.215 Y256.162 E26.49969
G1 X99.515 Y255.569 E27.20652
G1 X99.853 Y254.997 E27.91333
G1 X100.227 Y254.447 E28.62074
G1 X100.637 Y253.921 E29.32961
G1 X101.08 Y253.421 E30.04057
G1 X101.556 Y252.95 E30.75271
G1 X102.321 Y252.305 E31.81792
G1 X103.122 Y251.752 E32.85272
M73 P49 R0
G1 X103.971 Y251.28 E33.88581
G1 X104.862 Y250.892 E34.91969
G1 X105.796 Y250.588 E35.96462
G1 X106.77 Y250.378 E37.02422
G1 X107.759 Y250.269 E38.08257
G1 X108.547 Y250.257 E38.92015
G1 X109.146 Y250.298 E39.55974
G1 E29.55974 F2400
G92 E0
G1 Z8.4 F1800
M98 P"/macros/place_tool_3"
T3
G92 E0
G10 S200 ; set temperature
M98 P"/macros/grab_tool_4"
M73 P51 R0
G1 U11
G1 E-2 F2400
G92 E0
G1 X108.377 Y260.916 F7800
G1 Z.4 F1800
M73 P52 R0
G1 E2 F2400
M73 P53 R0
G1 F6000
G1 X109.446 Y251.443 E12.14019
G1 X109.976 Y251.523 E12.71026
G1 X110.669 Y251.682 E13.46668
G1 X111.348 Y251.891 E14.22187
G1 X112.01 Y252.149 E14.97727
G1 X112.655 Y252.456 E15.73714
G1 X113.275 Y252.808 E16.49619
G1 X113.868 Y253.205 E17.25518
G1 X114.27 Y253.519 E17.79753
G1 X108.414 Y260.869 E27.79425
G1 E17.79425 F2400
G92 E0
M73 P54 R0
G1 Z8.4 F1800
M98 P"/macros/place_tool_4"
T4
G92 E0
G10 S200 ; set temperature
M98 P"/macros/grab_tool_5"
M73 P55 R0
G1 U11
G1 E-2 F2400
G92 E0
G1 X131.481 Y232.986 F7800
M73 P56 R0
G1 Z.4 F1800
M73 P58 R0
G1 E2 F2400
G1 F6000
G1 X131.57 Y233.282 E2.32849
G1 X131.567 Y233.915 E3.00171
G1 X131.453 Y234.627 E3.76902
G1 X131.255 Y235.439 E4.65809
G1 X130.952 Y236.418 E5.74799
G1 X130.537 Y237.575 E7.05555
G1 X129.96 Y239.031 E8.72136
G1 X129.375 Y240.403 E10.3075
G1 X128.629 Y242.064 E12.2447
G1 X126.832 Y245.839 E16.6918
G1 X124.161 Y251.175 E23.03832
G1 X120.408 Y258.553 E31.84347
G1 X119.408 Y260.577 E34.24474
G1 X118.573 Y262.337 E36.31686
G1 X118.01 Y263.665 E37.85098
G1 X117.648 Y264.644 E38.96118
G1 X117.525 Y265.133 E39.497
G1 X117.332 Y266.28 E40.73417
G1 X117.188 Y266.864 E41.37476
G1 X117.034 Y267.373 E41.94048
G1 X116.835 Y267.905 E42.54417
G1 X116.531 Y268.602 E43.35331
G1 X115.979 Y269.618 E44.58282
M73 P59 R0
G1 X115.61 Y270.167 E45.28633
G1 X115.16 Y270.749 E46.06914
G1 X114.679 Y271.289 E46.83811
G1 X114.226 Y271.732 E47.51211
G1 X113.608 Y272.265 E48.38052
G1 X113.168 Y272.592 E48.96301
G1 X112.556 Y272.989 E49.73888
G1 X111.855 Y273.376 E50.59094
G1 X111.21 Y273.67 E51.34497
G1 X110.536 Y273.92 E52.10904
G1 X109.873 Y274.114 E52.84346
G1 X109.229 Y274.255 E53.54511
G1 X108.516 Y274.359 E54.31162
G1 X107.787 Y274.411 E55.08896
G1 X106.697 Y274.378 E56.2491
G1 X107.761 Y264.23 E67.10222
G1 X109.302 Y262.285 E69.74147
G1 X131.445 Y233.034 E108.76414
G92 E0
M73 P60 R0
G1 Z8.4 F1800
M98 P"/macros/place_tool_5"
T5
G92 E0
G10 S200 ; set temperature
M98 P"/macros/grab_tool_6"
M73 P61 R0
G1 U11
G1 E-2 F2400
G92 E0
G1 X103.615 Y298.464 F7800
M73 P63 R0
G1 Z.4 F1800
M73 P64 R0
G1 E2 F2400
G1 F6000
G1 X103.165 Y298.395 E2.48341
G1 X102.52 Y298.251 E3.18706
G1 X101.569 Y297.951 E4.2477
G1 X100.958 Y297.699 E4.95088
G1 X100.364 Y297.405 E5.65552
G1 X99.522 Y296.894 E6.70356
G1 X98.999 Y296.517 E7.38916
G1 X98.259 Y295.886 E8.42355
G1 X97.583 Y295.186 E9.45876
G1 X97.171 Y294.685 E10.14839
G1 X96.863 Y294.263 E10.70371
G1 X96.578 Y293.827 E11.25813
G1 X96.315 Y293.378 E11.81117
G1 X96.076 Y292.918 E12.36321
G1 X95.859 Y292.447 E12.91464
G1 X95.667 Y291.966 E13.46571
G1 X95.499 Y291.476 E14.01676
M73 P65 R0
G1 X95.355 Y290.978 E14.56815
G1 X95.236 Y290.472 E15.12024
G1 X95.142 Y289.961 E15.67335
G1 X95.074 Y289.444 E16.22776
G1 X95.032 Y288.923 E16.784
G1 X95.015 Y288.4 E17.34021
G1 X95.025 Y287.879 E17.8947
G1 X95.061 Y287.36 E18.44776
G1 X95.123 Y286.845 E18.99984
G1 X95.21 Y286.334 E19.55128
G1 X95.322 Y285.828 E20.10235
G1 X95.459 Y285.329 E20.65342
G1 X95.621 Y284.836 E21.20483
G1 X95.808 Y284.352 E21.75689
G1 X96.019 Y283.876 E22.30994
G1 X96.253 Y283.412 E22.86349
G1 X96.609 Y282.799 E23.61712
G1 X96.911 Y282.34 E24.20182
G1 X97.238 Y281.898 E24.78678
G1 X97.588 Y281.474 E25.37195
G1 X97.962 Y281.067 E25.9587
G1 X98.358 Y280.681 E26.5474
G1 X98.772 Y280.318 E27.13373
G1 X99.337 Y279.891 E27.8864
G1 X104.797 Y288.346 E38.59175
G1 X104.492 Y290.853 E41.27813
G1 X103.622 Y298.404 E49.36271
G92 E0
G1 Z8.4 F1800
M98 P"/macros/place_tool_6"
T6
G92 E0
G10 S200 ; set temperature
M98 P"/macros/grab_tool_7"
M73 P67 R0
G1 U11
G1 E-2 F2400
G92 E0
G1 X102.247 Y313.471 F7800
G1 Z.4 F1800
M73 P69 R0
G1 E2 F2400
G1 F6000
G1 X103.444 Y303.258 E79.7812
M73 P70 R0
G1 X104.218 Y303.39 E85.72041
G1 X105.174 Y303.657 E93.23276
G1 X106.098 Y304.02 E100.74307
G1 X106.983 Y304.478 E108.27735
M73 P71 R0
G1 X107.798 Y305.01 E115.63398
G1 X108.556 Y305.615 E122.97604
G1 X109.252 Y306.292 E130.3178
G1 X109.883 Y307.035 E137.68999
G1 X110.276 Y307.581 E142.77957
G1 X110.631 Y308.15 E147.85519
G1 X110.948 Y308.739 E152.90986
G1 X111.225 Y309.345 E157.94961
G1 X111.463 Y309.966 E162.97967
M73 P72 R0
G1 X111.66 Y310.6 E168.00454
G1 X111.816 Y311.246 E173.03011
G1 X111.931 Y311.901 E178.06009
G1 X112.004 Y312.563 E183.09997
G1 X112.035 Y313.231 E188.15506
G1 X112.022 Y313.902 E193.23089
G1 X111.966 Y314.574 E198.33363
G1 X111.866 Y315.241 E203.4368
G1 X111.724 Y315.897 E208.51213
G1 X111.541 Y316.54 E213.56764
G1 X111.318 Y317.168 E218.60716
G1 X111.055 Y317.779 E223.63692
M73 P73 R0
G1 X110.754 Y318.371 E228.66217
G1 X110.416 Y318.943 E233.68721
G1 X110.042 Y319.493 E238.71678
G1 X109.633 Y320.019 E243.75642
G1 X109.19 Y320.519 E248.81092
G1 X108.713 Y320.991 E253.88622
G1 X108.205 Y321.433 E258.97653
G1 X107.421 Y322.012 E266.35626
G1 X106.587 Y322.512 E273.70478
G1 X105.709 Y322.928 E281.0528
M73 P74 R0
G1 X104.794 Y323.259 E288.41714
G1 X103.827 Y323.503 E295.95894
G1 X102.843 Y323.646 E303.47658
G1 X101.85 Y323.686 E310.99452
G1 X100.855 Y323.623 E318.53552
G1 X99.831 Y323.448 E326.39409
G1 X98.833 Y323.165 E334.24279
G1 X97.869 Y322.777 E342.10283
M73 P75 R0
G1 X97.253 Y322.464 E347.32877
G1 X96.512 Y322.01 E353.89987
G1 X96.045 Y321.672 E358.26321
G1 X95.646 Y321.351 E362.13042
G1 X95.265 Y321.01 E366.00212
G1 X94.898 Y320.647 E369.9095
G1 X94.55 Y320.265 E373.81914
G1 X94.034 Y319.613 E380.10454
G1 X102.166 Y313.596 E456.62348
M73 P76 R0
G1 X102.214 Y313.522 E457.29471
G92 E0
M73 P77 R0
G1 Z8.4 F1800
M98 P"/macros/place_tool_7"
T7
G92 E0
G10 S200 ; set temperature
M98 P"/macros/grab_tool_8"
M73 P78 R0
G1 U11
G1 E-2 F2400
G92 E0
G1 X110.647 Y237.894 F7800
M73 P79 R0
G1 Z.4 F1800
M73 P81 R0
G1 E2 F2400
G1 F6000
G1 X110.505 Y237.943 E3.13474
G1 X108.781 Y239.712 E21.82285
G1 X103.621 Y245.134 E78.43786
M73 P82 R0
G1 X103.059 Y244.553 E84.55177
G1 X102.431 Y243.759 E92.21129
G1 X101.992 Y243.081 E98.31731
G1 X101.441 Y242.004 E107.46944
M73 P83 R0
G1 X101.036 Y240.925 E116.18282
G1 X100.843 Y240.205 E121.82764
G1 X100.7 Y239.427 E127.80605
G1 X100.608 Y238.524 E134.67097
G1 X100.598 Y237.616 E141.54395
G1 X100.633 Y237.091 E145.51917
G1 X100.696 Y236.57 E149.48793
G1 X100.786 Y236.054 E153.45506
G1 X100.904 Y235.543 E157.42151
G1 X101.05 Y235.038 E161.39112
M73 P84 R0
G1 X101.222 Y234.542 E165.36555
G1 X101.421 Y234.054 E169.34898
G1 X101.646 Y233.579 E173.3301
G1 X102.065 Y232.834 E179.79487
G1 X102.617 Y232.035 E187.141
G1 X103.024 Y231.536 E192.00849
G1 X103.462 Y231.065 E196.87583
G1 X104.178 Y230.409 E204.21858
G1 X104.955 Y229.822 E211.5881
G1 X105.784 Y229.311 E218.95192
M73 P85 R0
G1 X106.657 Y228.882 E226.30995
G1 X107.568 Y228.537 E233.67783
G1 X108.532 Y228.275 E241.23017
G1 X109.527 Y228.108 E248.85855
G1 X110.191 Y228.053 E253.89849
G1 X111.537 Y228.076 E264.08272
G1 X112.531 Y228.209 E271.67248
G1 X113.177 Y228.35 E276.67309
G1 X113.812 Y228.532 E281.66575
M73 P86 R0
G1 X114.431 Y228.755 E286.64323
G1 X115.034 Y229.016 E291.61098
G1 X115.617 Y229.316 E296.57367
G1 X116.18 Y229.653 E301.5364
G1 X116.721 Y230.025 E306.50435
G1 X117.238 Y230.433 E311.48201
G1 X117.728 Y230.875 E316.47509
G1 X118.19 Y231.35 E321.48927
G1 X118.624 Y231.857 E326.53509
G1 X119.012 Y232.373 E331.4201
G1 X119.533 Y233.192 E338.75683
M73 P87 R0
G1 X119.971 Y234.055 E346.07511
G1 X120.324 Y234.956 E353.40296
G1 X120.593 Y235.908 E360.87936
G1 X120.764 Y236.887 E368.40091
G1 X120.835 Y237.878 E375.91548
G1 X120.804 Y238.873 E383.44337
G1 X120.672 Y239.862 E390.98711
G1 X120.44 Y240.829 E398.50814
M73 P88 R0
G1 X120.112 Y241.766 E406.0228
G1 X119.689 Y242.667 E413.55168
G1 X119.186 Y243.508 E420.96023
G1 X118.61 Y244.286 E428.28353
G1 X117.963 Y245.005 E435.6022
G1 X117.249 Y245.66 E442.93118
G1 X116.471 Y246.246 E450.29395
G1 X115.642 Y246.755 E457.64936
M73 P89 R0
G1 X114.77 Y247.182 E464.99983
G1 X113.86 Y247.526 E472.35967
G1 X112.896 Y247.787 E479.91067
G1 X111.902 Y247.953 E487.52955
G1 X110.897 Y248.02 E495.15519
G1 X110.24 Y248.01 E500.11791
G1 X109.732 Y247.971 E503.97383
G1 X110.91 Y238.136 E578.89314
M73 P91 R0
G1 X110.881 Y238.021 E579.79206
G1 X110.7 Y237.922 E581.35176
G1 E579.35176 F2400
G92 E0
G1 Z8.4 F1800
M107
;TYPE:Custom
M98 P"/macros/place_tool_8"
;M104 S0 ; turn off temperature
G28 X0  ; home X axis
M84     ; disable motors
M73 P100 R0
; filament used [mm] = 1759.63, 28.87, 37.56, 25.79, 106.76, 47.36, 455.29, 579.35
; filament used [cm3] = 0.03, 0.00, 0.00, 0.00, 0.01, 0.01, 0.01, 0.01
; total filament used [g] = 0.00
; total filament cost = 0.00
; estimated printing time (normal mode) = 50s

; prusaslicer_config = begin
; avoid_crossing_perimeters = 1
; avoid_crossing_perimeters_max_detour = 0.1
; bed_custom_model = 
; bed_custom_texture = 
; bed_shape = 0x0,725x0,725x930,0x930
; bed_temperature = 0,0,0,0,0,0,0,0
; before_layer_gcode = 
; between_objects_gcode = 
; bottom_fill_pattern = monotonic
; bottom_solid_layers = 0
; bottom_solid_min_thickness = 0
; bridge_acceleration = 0
; bridge_angle = 0
; bridge_fan_speed = 100,100,100,100,100,100,100,100
; bridge_flow_ratio = 1
; bridge_speed = 60
; brim_separation = 0
; brim_type = outer_only
; brim_width = 0
; clip_multipart_objects = 1
; color_change_gcode = M600
; complete_objects = 0
; cooling = 0,0,0,0,0,0,0,0
; cooling_tube_length = 0
; cooling_tube_retraction = 0
; default_acceleration = 0
; default_filament_profile = 
; default_print_profile = 
; deretract_speed = 0,0,0,0,0,0,0,0
; disable_fan_first_layers = 3,3,3,3,3,3,3,3
; dont_support_bridges = 1
; draft_shield = disabled
; duplicate_distance = 6
; elefant_foot_compensation = 0
; end_filament_gcode = "M98 P\"/macros/place_tool_1\"";"M98 P\"/macros/place_tool_2\"";"M98 P\"/macros/place_tool_3\"";"M98 P\"/macros/place_tool_4\"";"M98 P\"/macros/place_tool_5\"";"M98 P\"/macros/place_tool_6\"";"M98 P\"/macros/place_tool_7\"";"M98 P\"/macros/place_tool_8\""
; end_gcode = ;M104 S0 ; turn off temperature\nG28 X0  ; home X axis\nM84     ; disable motors\n
; ensure_vertical_shell_thickness = 0
; external_perimeter_extrusion_width = 0.45
; external_perimeter_speed = 50%
; external_perimeters_first = 1
; extra_loading_move = 0
; extra_perimeters = 0
; extruder_clearance_height = 10
; extruder_clearance_radius = 10
; extruder_colour = #000000;;#FC3D99;#20A503;#EFA447;#FBFF0E;#FFFFFF;#FB00EA
; extruder_offset = 0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0
; extrusion_axis = E
; extrusion_multiplier = 1,1,1,1,1,1,1,1
; extrusion_width = 0.45
; fan_always_on = 0,0,0,0,0,0,0,0
; fan_below_layer_time = 60,60,60,60,60,60,60,60
; filament_colour = #29B2B2;#29B2B2;#29B2B2;#29B2B2;#29B2B2;#29B2B2;#29B2B2;#29B2B2
; filament_cooling_final_speed = 3.4,3.4,3.4,3.4,3.4,3.4,3.4,3.4
; filament_cooling_initial_speed = 2.2,2.2,2.2,2.2,2.2,2.2,2.2,2.2
; filament_cooling_moves = 4,4,4,4,4,4,4,4
; filament_cost = 0,0,0,0,0,0,0,0
; filament_density = 0,0,0,0,0,0,0,0
; filament_diameter = 0.15,0.4,0.4,0.4,0.4,0.4,0.15,0.15
; filament_load_time = 0,0,0,0,0,0,0,0
; filament_loading_speed = 28,28,28,28,28,28,28,28
; filament_loading_speed_start = 3,3,3,3,3,3,3,3
; filament_max_volumetric_speed = 0,0,0,0,0,0,0,0
; filament_minimal_purge_on_wipe_tower = 15,15,15,15,15,15,15,15
; filament_notes = ;;;;;;;
; filament_ramming_parameters = "120 100 6.6 6.8 7.2 7.6 7.9 8.2 8.7 9.4 9.9 10.0| 0.05 6.6 0.45 6.8 0.95 7.8 1.45 8.3 1.95 9.7 2.45 10 2.95 7.6 3.45 7.6 3.95 7.6 4.45 7.6 4.95 7.6";"120 100 6.6 6.8 7.2 7.6 7.9 8.2 8.7 9.4 9.9 10.0| 0.05 6.6 0.45 6.8 0.95 7.8 1.45 8.3 1.95 9.7 2.45 10 2.95 7.6 3.45 7.6 3.95 7.6 4.45 7.6 4.95 7.6";"120 100 6.6 6.8 7.2 7.6 7.9 8.2 8.7 9.4 9.9 10.0| 0.05 6.6 0.45 6.8 0.95 7.8 1.45 8.3 1.95 9.7 2.45 10 2.95 7.6 3.45 7.6 3.95 7.6 4.45 7.6 4.95 7.6";"120 100 6.6 6.8 7.2 7.6 7.9 8.2 8.7 9.4 9.9 10.0| 0.05 6.6 0.45 6.8 0.95 7.8 1.45 8.3 1.95 9.7 2.45 10 2.95 7.6 3.45 7.6 3.95 7.6 4.45 7.6 4.95 7.6";"120 100 6.6 6.8 7.2 7.6 7.9 8.2 8.7 9.4 9.9 10.0| 0.05 6.6 0.45 6.8 0.95 7.8 1.45 8.3 1.95 9.7 2.45 10 2.95 7.6 3.45 7.6 3.95 7.6 4.45 7.6 4.95 7.6";"120 100 6.6 6.8 7.2 7.6 7.9 8.2 8.7 9.4 9.9 10.0| 0.05 6.6 0.45 6.8 0.95 7.8 1.45 8.3 1.95 9.7 2.45 10 2.95 7.6 3.45 7.6 3.95 7.6 4.45 7.6 4.95 7.6";"120 100 6.6 6.8 7.2 7.6 7.9 8.2 8.7 9.4 9.9 10.0| 0.05 6.6 0.45 6.8 0.95 7.8 1.45 8.3 1.95 9.7 2.45 10 2.95 7.6 3.45 7.6 3.95 7.6 4.45 7.6 4.95 7.6";"120 100 6.6 6.8 7.2 7.6 7.9 8.2 8.7 9.4 9.9 10.0| 0.05 6.6 0.45 6.8 0.95 7.8 1.45 8.3 1.95 9.7 2.45 10 2.95 7.6 3.45 7.6 3.95 7.6 4.45 7.6 4.95 7.6"
; filament_settings_id = "Archiplotter_8_Farben.3mf (Werkzeug 1)";"Archiplotter_8_Farben.3mf (Werkzeug 2)";"Archiplotter_8_Farben.3mf (Werkzeug 3)";"Archiplotter_8_Farben.3mf (Werkzeug 4)";"Archiplotter_8_Farben.3mf (Werkzeug 5)";"Archiplotter_8_Farben.3mf (Werkzeug 6)";"Archiplotter_8_Farben.3mf (Werkzeug 7)";"Archiplotter_8_Farben.3mf (Werkzeug 8)"
; filament_soluble = 0,0,0,0,0,0,0,0
; filament_spool_weight = 0,0,0,0,0,0,0,0
; filament_toolchange_delay = 0,0,0,0,0,0,0,0
; filament_type = PLA;PLA;PLA;PLA;PLA;PLA;PLA;PLA
; filament_unload_time = 0,0,0,0,0,0,0,0
; filament_unloading_speed = 90,90,90,90,90,90,90,90
; filament_unloading_speed_start = 100,100,100,100,100,100,100,100
; filament_vendor = (Unknown)
; fill_angle = 225
; fill_density = 0%
; fill_pattern = hilbertcurve
; first_layer_acceleration = 0
; first_layer_acceleration_over_raft = 0
; first_layer_bed_temperature = 0,0,0,0,0,0,0,0
; first_layer_extrusion_width = 0.42
; first_layer_height = 0.4
; first_layer_speed = 100
; first_layer_speed_over_raft = 30
; first_layer_temperature = 200,200,200,200,200,200,200,200
; full_fan_speed_layer = 0,0,0,0,0,0,0,0
; fuzzy_skin = all
; fuzzy_skin_point_dist = 0.1
; fuzzy_skin_thickness = 0.3
; gap_fill_enabled = 0
; gap_fill_speed = 20
; gcode_comments = 0
; gcode_flavor = reprapfirmware
; gcode_label_objects = 0
; gcode_resolution = 0.0125
; gcode_substitutions = 
; high_current_on_filament_swap = 0
; host_type = octoprint
; infill_acceleration = 0
; infill_anchor = 600%
; infill_anchor_max = 0
; infill_every_layers = 1
; infill_extruder = 1
; infill_extrusion_width = 0.45
; infill_first = 0
; infill_only_where_needed = 0
; infill_overlap = 0
; infill_speed = 80
; interface_shells = 0
; ironing = 0
; ironing_flowrate = 15%
; ironing_spacing = 0.1
; ironing_speed = 15
; ironing_type = top
; layer_gcode = 
; layer_height = 0.3
; machine_limits_usage = time_estimate_only
; machine_max_acceleration_e = 10000,5000
; machine_max_acceleration_extruding = 1500,1250
; machine_max_acceleration_retracting = 1500,1250
; machine_max_acceleration_travel = 1500,1250
; machine_max_acceleration_x = 9000,1000
; machine_max_acceleration_y = 9000,1000
; machine_max_acceleration_z = 500,200
; machine_max_feedrate_e = 120,120
; machine_max_feedrate_x = 500,200
; machine_max_feedrate_y = 500,200
; machine_max_feedrate_z = 12,12
; machine_max_jerk_e = 2.5,2.5
; machine_max_jerk_x = 10,10
; machine_max_jerk_y = 10,10
; machine_max_jerk_z = 0.2,0.4
; machine_min_extruding_rate = 0,0
; machine_min_travel_rate = 0,0
; max_fan_speed = 100,100,100,100,100,100,100,100
; max_layer_height = 0,0,0,0,0,0,0,0
; max_print_height = 200
; max_print_speed = 80
; max_volumetric_extrusion_rate_slope_negative = 0
; max_volumetric_extrusion_rate_slope_positive = 0
; max_volumetric_speed = 0
; min_bead_width = 85%
; min_fan_speed = 35,35,35,35,35,35,35,35
; min_feature_size = 25%
; min_layer_height = 0.01,0.01,0.01,0.01,0.01,0.01,0.01,0.01
; min_print_speed = 10,10,10,10,10,10,10,10
; min_skirt_length = 0
; mmu_segmented_region_max_width = 0
; notes = 
; nozzle_diameter = 0.4,0.4,0.4,0.4,0.4,0.4,0.4,0.4
; only_retract_when_crossing_perimeters = 0
; ooze_prevention = 0
; output_filename_format = [input_filename_base].gcode
; overhangs = 0
; parking_pos_retraction = 0
; pause_print_gcode = M601
; perimeter_acceleration = 0
; perimeter_extruder = 1
; perimeter_extrusion_width = 0.45
; perimeter_generator = arachne
; perimeter_speed = 60
; perimeters = 1
; physical_printer_settings_id = 
; post_process = 
; print_settings_id = Archiplotter_8_Farben.3mf (ArchiplotteUpscale 24.10. Jakob)
; printer_model = 
; printer_notes = 
; printer_settings_id = Archiplotter_8_Farben.3mf (ArchiplotterUpscale_KleinerAufbau 12Dez23)
; printer_technology = FFF
; printer_variant = 
; printer_vendor = 
; raft_contact_distance = 0.1
; raft_expansion = 1.5
; raft_first_layer_density = 90%
; raft_first_layer_expansion = 3
; raft_layers = 0
; remaining_times = 1
; resolution = 0
; retract_before_travel = 0,2,2,2,0,0,0,0
; retract_before_wipe = 0%,0%,0%,0%,0%,0%,0%,0%
; retract_layer_change = 0,0,0,0,0,0,0,0
; retract_length = 2,2,2,2,2,2,2,2
; retract_length_toolchange = 0,10,10,10,0,0,0,0
; retract_lift = 8,8,8,8,8,8,8,8
; retract_lift_above = 0,0,0,0,0,0,0,0
; retract_lift_below = 0,0,0,0,0,0,0,0
; retract_restart_extra = 0,0,0,0,0,0,0,0
; retract_restart_extra_toolchange = 0,0,0,0,0,0,0,0
; retract_speed = 40,40,40,40,40,40,40,40
; seam_position = aligned
; silent_mode = 1
; single_extruder_multi_material = 1
; single_extruder_multi_material_priming = 1
; skirt_distance = 6
; skirt_height = 1
; skirts = 0
; slice_closing_radius = 0.049
; slicing_mode = regular
; slowdown_below_layer_time = 5,5,5,5,5,5,5,5
; small_perimeter_speed = 15
; solid_infill_below_area = 0
; solid_infill_every_layers = 0
; solid_infill_extruder = 1
; solid_infill_extrusion_width = 0.45
; solid_infill_speed = 20
; spiral_vase = 0
; standby_temperature_delta = -5
; start_filament_gcode = "M98 P\"/macros/grab_tool_1\"\nG1 Z10";"M98 P\"/macros/grab_tool_2\"\nG1 U11";"M98 P\"/macros/grab_tool_3\"\nG1 U11";"M98 P\"/macros/grab_tool_4\"\nG1 U11";"M98 P\"/macros/grab_tool_5\"\nG1 U11";"M98 P\"/macros/grab_tool_6\"\nG1 U11";"M98 P\"/macros/grab_tool_7\"\nG1 U11";"M98 P\"/macros/grab_tool_8\"\nG1 U11"
; start_gcode = ;G28 ; home all axes\n;G1 Z5 F5000 ; lift nozzle\n;uValueUp=20\n;uValueDown=5
; support_material = 0
; support_material_angle = 0
; support_material_auto = 0
; support_material_bottom_contact_distance = 0
; support_material_bottom_interface_layers = -1
; support_material_buildplate_only = 0
; support_material_closing_radius = 2
; support_material_contact_distance = 0.2
; support_material_enforce_layers = 0
; support_material_extruder = 1
; support_material_extrusion_width = 0.35
; support_material_interface_contact_loops = 0
; support_material_interface_extruder = 1
; support_material_interface_layers = 3
; support_material_interface_pattern = rectilinear
; support_material_interface_spacing = 0
; support_material_interface_speed = 100%
; support_material_pattern = rectilinear
; support_material_spacing = 2.5
; support_material_speed = 60
; support_material_style = grid
; support_material_synchronize_layers = 0
; support_material_threshold = 0
; support_material_with_sheath = 1
; support_material_xy_spacing = 50%
; temperature = 200,200,200,200,200,200,200,200
; template_custom_gcode = 
; thick_bridges = 0
; thin_walls = 1
; threads = 10
; thumbnails = 
; thumbnails_format = PNG
; toolchange_gcode = 
; top_fill_pattern = monotonic
; top_infill_extrusion_width = 0.4
; top_solid_infill_speed = 15
; top_solid_layers = 0
; top_solid_min_thickness = 0
; travel_speed = 130
; travel_speed_z = 30
; use_firmware_retraction = 0
; use_relative_e_distances = 0
; use_volumetric_e = 0
; variable_layer_height = 1
; wall_distribution_count = 1
; wall_transition_angle = 10
; wall_transition_filter_deviation = 25%
; wall_transition_length = 100%
; wipe = 0,0,0,0,0,0,0,0
; wipe_into_infill = 0
; wipe_into_objects = 0
; wipe_tower = 0
; wipe_tower_bridging = 10
; wipe_tower_brim_width = 2
; wipe_tower_no_sparse_layers = 0
; wipe_tower_rotation_angle = 0
; wipe_tower_width = 60
; wipe_tower_x = 180
; wipe_tower_y = 140
; wiping_volumes_extruders = 70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70
; wiping_volumes_matrix = 0,140,140,140,140,140,140,140,140,0,140,140,140,140,140,140,140,140,0,140,140,140,140,140,140,140,140,0,140,140,140,140,140,140,140,140,0,140,140,140,140,140,140,140,140,0,140,140,140,140,140,140,140,140,0,140,140,140,140,140,140,140,140,0
; xy_size_compensation = 0
; z_offset = 0
; prusaslicer_config = end
