; Configuration file for Duet WiFi (firmware version 3.3)
; executed by the firmware on start-up
;
; generated by RepRapFirmware Configuration Tool v3.3.10 on Sun Jun 05 2022 16:11:22 GMT+0200 (Central European Summer Time)

; General preferences
G90                            ; send absolute coordinates...
M83                            ; ...but relative extruder moves
M550 P"Archiplot"              ; set printer name

; Network
M552 S1                        ; enable network
M586 P0 S1                     ; enable HTTP
M586 P1 S0                     ; disable FTP
M586 P2 S0                     ; disable Telnet
;M552 P192.168.3.126		       ;fixe ip

; Drives
M569 P0 S0 D3                  ; XL physical drive 0 goes backwards, sensorless homing
M569 P1 S1 D3                  ; Y  physical drive 1 goes forwards, sensorless homing
M569 P3 S1 D3                  ; U - Z2 physical drive 2 goes forwards, sensorless homing
M569 P5 S1 D3 ;V10000          ; XR physical drive 5 goes forwards, sensorless homing, hybrid speed
M569 P2 S0 D3                  ; Z physical drive 2 goes backwards, sensorless homing

M584 X0:5 Y1 Z2 U3                ; set drive mapping
M350 X256 Y256 Z256 U16 I1            ; configure microstepping with interpolation
M92 X682.67 Y711.1 Z17066.67 U88.96        ; set steps per mm
M566 X900.00 Y900.00 Z100.00 U600   ; set maximum instantaneous speed changes (mm/min)
M203 X20000.00 Y20000.00 Z1500.00 U20000; set maximum speeds (mm/min)
M201 X200.00 Y200.00 Z100.00 U 400  ; set accelerations (mm/s^2)
M906 X2500 Y2500 Z1000 U1700 I30     ; set motor currents (mA) and motor idle factor in per cent
M84 S30                        ; Set idle timeout

; Axis Limits
M208 X0 Y0 Z0 S1           ; set axis minima
M208 X1450 Y1864 Z70 U35.1 S0        ; set axis maxima

; Endstops
M574 X1 S3                    ; configure endstop for low end on X
M574 Y1 S3                    ; configure endstop for low end on Y
M574 Z1 S3                    ; configure Z-probe endstop for low end on Z
M574 U1 S3 					  ; configure endstop for low end on Z

; Sensorless homing
M915 X S3 R0 F0               ; set up sensorless homing on X
M915 Y S3 R0 F0				  ; set up sensorless homing on Y
;M915 Z S3 R0 F0				  ; set up sensorless homing on Z
M915 U S3 R0 F0				  ; set up sensorless homing on U

; Z-Probe
M558 P5 C"^io3.in" H10 F800 T6000        ; set Z probe type to switch and the dive height + speeds
G31 P500 X0 Y0 Z-8                    ; set Z probe trigger value, offset and trigger height
M557 X60:1450 Y10:1864 S150                ; define mesh grid

; Heaters
M140 H-1                       ; disable heated bed (overrides default heater mapping)

; Fans

; Tools
M563 P0 S"Stift_1" F0          ; define tool 0
G10 P0 X0 Y0 Z0                ; set tool 0 axis offsets
G10 P0 R0 S0                   ; set initial tool 0 active and standby temperatures to 0C

; Custom settings are not defined
