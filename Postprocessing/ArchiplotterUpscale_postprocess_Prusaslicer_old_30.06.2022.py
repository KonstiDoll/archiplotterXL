#!/usr/bin/python3


import sys 
import math

file_name = sys.argv[1]
new_file = file_name
hasHoming = False       # Set True to enable homing
upscale = True          # set True to multiply x and y values with factor
factor = 2              # scale factor

pump_distance = 0              # set to 0 to disable; millimeters between pumping action 
#line_number = 0
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

with open(file_name, 'r+') as f:
    
    if hasHoming == False: 
        sheetZero = "X0 Y0"                 #distance from starting zero to 0,0 of paper, needs to be in negative numbers       
        #homing = "G92 " + sheetZero + "\n"
        homing = ""
        
    else: 
        sheetZero = "X0 Y0"                             #distance from homing zero to 0,0 of paper, needs to be in negative numbers
        homing = "G28 X0 Y0\nG92 " + sheetZero + "\n"   #Add second ZAxis to homing #needs to be tested
    new_code = "G90\nG21\nM201 X200 Y200\n" + homing    #G90..absolute Coords; G21..metric;M201..acceleration
    content = f.readlines()                             # gcode as a list where each element is a line 
    
    for line in content:
        #print(line)
        pref_list = [ 'G0 ', 'G1 ', 'G2 ', 'G3 ', 'M226', 'G90', 'G91', 'M98']   #considered beginnings of line
        if line.startswith(tuple(pref_list)):       #
            contentMove = line.strip('/n').split()  #Array of line with each axis as one element
            
            if pump_distance != 0:    
                for element in contentMove:
                    if element.startswith('Z'):
                        Z = float(element.strip('Z'))
                    if element.startswith('Y'):
                        Y = float(element.strip('Y'))
                    if element.startswith('X'):
                        X = float(element.strip('X'))
                if Z == .4:
                    #print('drawing true')
                    drawing = True
                if Z != .4:
                    drawing = False
                    #print('drawing false')
                if drawing == True:
                    if first_number == True: # first number
                        drawing_y1 = Y
                        #print('drawing_y1', drawing_y1)
                        drawing_x1 = X
                        #print('drawing_x1', drawing_x1)
                        first_number = False
                    else:
                        drawing_y2 = Y
                        #print('drawing_y2', drawing_y2)
                        drawing_x2 = X
                        #print('drawing_x2', drawing_x2)
                        first_number = True
                    drawing_length = drawing_length + math.sqrt(pow((drawing_x2 - drawing_x1),2)+pow((drawing_y2 - drawing_y1),2))
                    #print('x distance', drawing_x2 - drawing_x1)
                    #print('y distance', drawing_y2 - drawing_y1)
                    #print('powerx2x1', math.sqrt(pow((drawing_x2 - drawing_x1),2)+pow((drawing_x2 - drawing_x1),2)))
                    #print('drawing_length',drawing_length)
                if drawing_length >= pump_distance:
                    drawing_length = 0
                    newLine = '; Pumpen'
                    new_code += newLine + '\n'
                    #newLine = 'G1 Z0'
                    #new_code += newLine + '\n'
                    newLine = 'G91 ; Pumpen'
                    new_code += newLine + '\n'
                    newLine = 'G1 U11'
                    new_code += newLine + '\n'
                    newLine = 'G1 U-11'
                    new_code += newLine + '\n'
                    newLine = 'G90 ; Pumpen'
                    new_code += newLine + '\n'
                    #newLine = 'G1 Z10'             
                    #new_code += newLine + '\n'
                    
            newLine = ''

	    # just copy the line to the new code	
        if element.startswith('M98'):
            newLine = element
            new_code += newLine + '\n'

            for element in contentMove:             
                if 'E' not in element:# and 'Z' not in element:      #use everthing but ExtruderMoves and Z Axis
                    if upscale == True:
                        if element.startswith('X'):
                            element = 'X' + str(float(element.strip('X'))*factor) # multiply value with upscaleFactor and convert back to string with axis
                        if element.startswith('Y'):
                            element = 'Y' + str(float(element.strip('Y'))*factor)
                    newLine += element + ' '            
            new_code += newLine + '\n'
        
with open(new_file, 'w') as nf:
    nf.seek(0)
    nf.write(new_code + 'G1 F6000 X0 Y0')
    #print(new_code)


