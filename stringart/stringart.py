import math
import csv
import matplotlib.pyplot as plt

def generate_points(num_points, radius, origin):
    points = []
    angle_increment = 2 * math.pi / num_points

    for i in range(num_points):
        angle = i * angle_increment
        x = origin[0] + radius * math.cos(angle)
        y = origin[1] + radius * math.sin(angle)
        points.append((x, y))

    return points

def originSafeguard(radius, origin):
    if math.sqrt(origin[0]**2 + origin[1]**2) <= radius:
        return True
    else:
        return False

num_points = 288
radius = 500  ## in millimeters
## put the origin at twice the radius to the lower left of the circle
origin = (-radius*2, -radius*2)
origin = (0, 0) 

if __name__ == "__main__":
    ## safeguard: make sure the origin is not outside the circle
    if originSafeguard(radius, origin):
        points = generate_points(num_points, radius, origin)
        ## open csv file
        with open("points.csv", "rw") as pointsFile:
            ## read the file
            

            # ...

            if __name__ == "__main__":
                # safeguard: make sure the origin is not outside the circle
                if originSafeguard(radius, origin):
                    points = generate_points(num_points, radius, origin)
                    
                    # open csv file
                    with open("points.csv", "r") as pointsFile:
                        # read the file
                        csv_reader = csv.reader(pointsFile)
                        for row in csv_reader:
                            # process each row of the CSV file
                            # ...
                            file_tuple = tuple(file_contents)
                            x_values = [point[0] for point in points]
                            y_values = [point[1] for point in points]
                            plt.plot(x_values, y_values)

                            # Read the file and process each row
                            with open("points.csv", "r") as pointsFile:
                                csv_reader = csv.reader(pointsFile)
                                for row in csv_reader:
                                    # Get the corresponding coordinates from the row
                                    x = float(row[0])
                                    y = float(row[1])
                                    
                                    # Draw a line from the previous point to the current point
                                    plt.plot([x_values[-1], x], [y_values[-1], y], color='red')
                                    
                                    # Add the current point to the list of coordinates
                                    x_values.append(x)
                                    y_values.append(y)

                            plt.show()

                            file_tuple = tuple(file_contents)
                            x_values = [point[0] for point in points]
                            y_values = [point[1] for point in points]
                            plt.plot(x_values, y_values)
                            plt.show()
                                
                    # Draw lines between the points and show it on screen
                    
                else:
                    raise ValueError("Origin is outside the circle")


