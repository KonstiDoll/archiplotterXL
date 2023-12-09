; homey.g
; called to home the Y axis
;
; generated by RepRapFirmware Configuration Tool v3.3.10 on Sun Jun 05 2022 16:11:22 GMT+0200 (Central European Summer Time)

M400 ; wait for all commands to process -> clear the buffer

;M915 Y S1 R0 F0 ; settings for homing sensitivity

M913 X45 Y45 ; drop motor current

G91                ; relative positioning
G1 H2 Z5 F6000     ; lift Z relative to current position
G1 H1 Y-2005 F10000 ; move quickly to Y axis endstop and stop there (first pass)
G1 H2 Y5 F4000     ; go back a few mm
;G1 H1 Y-2005 F3600  ; move slowly to Y axis endstop once more (second pass)
G1 H2 Z-5 F6000    ; lower Z again
G90                ; absolute positioning


M913 X100 Y100 ; reset motor current to 100%