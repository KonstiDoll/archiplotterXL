; homex.g
; called to home the X axis
;
; generated by RepRapFirmware Configuration Tool v3.3.10 on Sun Jun 05 2022 16:11:22 GMT+0200 (Central European Summer Time)

M913 X60 Y70 ; drop motor current to 70%

; M915 X S1 R1 F1 ; settings for homing sensitivity

M400

G91                ; relative positioning
G1 H2 Z5 F6000     ; lift Z relative to current position
G1 H1 X-2405 F6000 ; move quickly to X axis endstop and stop there (first pass)
G1 H2 X-5 F6000     ; go back a few mm
G1 ;H1 X-2405 F6000  ; move slowly to X axis endstop once more (second pass)
G1 ;H2 Z-5 F6000    ; lower Z again
G90                ; absolute positioning

M913 X100 Y100 ; set motor current back to 100%