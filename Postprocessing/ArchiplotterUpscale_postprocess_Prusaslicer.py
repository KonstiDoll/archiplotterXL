#!/usr/bin/python3
import sys 
import math

file_name = sys.argv[1]
new_file = file_name
hasHoming = False       # Set True to enable homing
upscale = True          # set True to multiply x and y values with factor
factor = 2              # scale factor

pump_distance = 0              # set to 0 to disable; millimeters between pumping action 
drawing_length = 0.0
drawing_x1 = 0.0
drawing_y1 = 0.0
drawing_x2 = 0.0
drawing_y2 = 0.0
Z = 0.0
Y = 0.0
X = 0.0
first_number = False
drawing = False
lastZValue = 0.0
isAfterM98 = False

with open(file_name, 'r+') as f:
    homing = ""
    if hasHoming == True:  
        sheetZero = "X0 Y0"                             #distance from homing zero to 0,0 of paper, needs to be in negative numbers
        homing = "G28 X0 Y0 Z0\nG92 "+"\n"              #Add second ZAxis to homing #needs to be tested
    new_code = "G90\nG21\n" + homing                    #G90..absolute Coords; G21..metric;M201..acceleration
    content = f.readlines()                             #gcode as a list where each element is a line 
    
    for line in content:
        pref_list = [ 'G0 ', 'G1 ', 'G2 ', 'G3 ', 'M226', 'M98']   #considered beginnings of line
        
	    # just copy the line to the new code for Makrocalls
        if line.startswith('M98'):
            newLine = line
            new_code += newLine
            isAfterM98 = True

        elif line.startswith(tuple(pref_list)):       #
            contentMove = line.strip('/n').split()  #Array of line with each axis as one element
            
            if pump_distance != 0:    
                for element in contentMove:
                    if element.startswith('Z'):
                        Z = float(element.strip('Z'))
                        lastZValue = Z
                    if element.startswith('Y'):
                        Y = float(element.strip('Y'))
                    if element.startswith('X'):
                        X = float(element.strip('X'))
                if Z == .4:
                    drawing = True
                if Z != .4:
                    drawing = False
                if drawing == True:
                    if first_number == True: # first number
                        drawing_y1 = Y
                        drawing_x1 = X
                        first_number = False
                    else:
                        drawing_y2 = Y
                        drawing_x2 = X
                        first_number = True
                    drawing_length = drawing_length + math.sqrt(pow((drawing_x2 - drawing_x1),2)+pow((drawing_y2 - drawing_y1),2))
                    
                if drawing_length >= pump_distance:
                    drawing_length = 0
                    newLine = '; Pumpen'
                    new_code += newLine + '\n'
                    newLine = 'G91 ; Pumpen'
                    new_code += newLine + '\n'
                    newLine = 'G1 U11'
                    new_code += newLine + '\n'
                    newLine = 'G1 U-11'
                    new_code += newLine + '\n'
                    newLine = 'G90 ; Pumpen'
                    new_code += newLine + '\n'
                    
            newLine = ''


            for element in contentMove:             
                if 'E' not in element:# and 'Z' not in element:      #use everthing but ExtruderMoves and Z Axis
                    if upscale == True:
                        if element.startswith('X'):
                            element = 'X' + str(float(element.strip('X'))*factor) # multiply value with upscaleFactor and convert back to string with axis
                            isAfterM98 = False
                        if element.startswith('Y'):
                            element = 'Y' + str(float(element.strip('Y'))*factor)
                            isAfterM98 = False
                        if element.startswith('Z'):
                            if isAfterM98 == True:
                                continue
                    newLine += element + ' '            
            new_code += newLine + '\n'
        
with open(new_file, 'w') as nf:
    nf.seek(0)
    nf.write(new_code + 'G1 F6000 Y0') #X0 entfernt weil sonst Crash mit Werkzeughalter


