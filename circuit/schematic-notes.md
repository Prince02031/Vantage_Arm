# Vantage Arm - Hardware integration & Safety watchdog
## WattWatch Smart Office Monitoring System

This document details the hardware composition, electrical power routing, pin mappings, and judge-evaluation rationale for the ESP32-powered Safety Watchdog Station.

---

## 1. System Electrical Architecture & Power Delivery

To protect the ESP32 microcontroller from electrical noise and potential brownouts, the circuit implements a **dual-voltage power separation design** with a shared common ground:

1. **Logical Power Rail (3.3V)**:
   * **Driven by**: The ESP32's onboard linear regulator (max capacity ~250mA).
   * **Connected parts**: SSD1306 OLED (I2C), DHT22 Temp/Humidity sensor, Photoresistor (LDR), and the current-simulation potentiometer.
   * **Rationale**: These logic devices draw minimal current and are kept on a clean voltage rail to verify sensor ADC signal accuracy.

2. **High-Power Actuator Rail (5V/VIN)**:
   * **Driven by**: The 5V USB power bus connected to the `VIN` pin.
   * **Connected parts**: Wokwi-Servo (`joint1`), MQ-2 gas sensor (internal heating element), and the PIR motion sensor.
   * **Rationale**: The physical servo motor and the MQ-2 internal heater draws current spikes that would exceed the 3.3V regulator capacity. Separating them onto the 5V bus prevents controller brownouts.

3. **Common Ground**:
   * All GND pins (actuators, microcontroller, sensors) are tied together to establish a shared reference plane for signal integrity.

4. **Driver Protections**:
   * Inline **220-Ohm current-limiting resistors** are placed on each of the 6 status LEDs to restrict maximum GPIO pin output current below 15mA.
   * A **10K pull-up resistor** balances the E-Stop button connection to prevent floating input noise.

---

## 2. GPIO Pin Connection Table

| Connection ID | ESP32 Pin | Target Pin | Wire Color | Signal Type | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **I2C SDA** | `GPIO 21 (D21)` | `oled1:SDA` | Green | Digital I2C | OLED Serial Data line |
| **I2C SCL** | `GPIO 22 (D22)` | `oled1:SCL` | Yellow | Digital I2C | OLED Serial Clock line |
| **DHT22** | `GPIO 15 (D15)` | `dht1:SDA` | Green | Digital Input | Air Temp & Humidity readings |
| **PIR Sensor** | `GPIO 4 (D4)` | `pir1:OUT` | Green | Digital Input | Proximity Detection alerts |
| **LDR Sensor** | `GPIO 34 (D34)` | `ldr1:AO` | Green | Analog Input | Ambient light intensity readings |
| **MQ-2 Sensor** | `GPIO 35 (D35)` | `mq2_1:AOUT` | Green | Analog Input | Smoke and combustible gas density |
| **Potentiometer** | `GPIO 32 (D32)` | `pot1:SIG` | Green | Analog Input | Simulated current draw selector (0-6A) |
| **Servo Motor** | `GPIO 13 (D13)` | `servo1:PWM` | Orange | PWM Output | Joint 1 motor position control signal |
| **Panic Button** | `GPIO 14 (D14)` | `btn1:1.l` | Green | Digital Input | Manual E-Stop Pushbutton (active LOW) |
| **Buzzer** | `GPIO 27 (D27)` | `buzzer1:1` | Green | Digital Output | Alarm sound driver |
| **LED 1** | `GPIO 16 (D16)` | `led1:A` (via Resistor) | Green | Digital Output | Load indicator (0.5A threshold) |
| **LED 2** | `GPIO 17 (D17)` | `led2:A` (via Resistor) | Green | Digital Output | Load indicator (1.5A threshold) |
| **LED 3** | `GPIO 18 (D18)` | `led3:A` (via Resistor) | Green | Digital Output | Load indicator (2.5A threshold) |
| **LED 4** | `GPIO 19 (D19)` | `led4:A` (via Resistor) | Green | Digital Output | Load indicator (3.5A threshold) |
| **LED 5** | `GPIO 23 (D23)` | `led5:A` (via Resistor) | Green | Digital Output | Load indicator (4.5A threshold) |
| **LED 6** | `GPIO 25 (D25)` | `led6:A` (via Resistor) | Green | Digital Output | Load indicator (5.5A threshold) |

---

## 3. Robot Arm Safety Integration Rationale

Each sensor in this local watchdog station maps directly to a safety requirement within the Vantage Arm control code:

*   **Potentiometer $\to$ Closed-loop Joint Current Feedback**:
    Simulates the ACS712 current sensor. If the arm experiences an obstacle collision or mechanical jam, motor torque rises, drawing higher current. The ESP32 reads this analog voltage and sets warning levels on the LED ladder, warning operators of overload states.
*   **Joint Servo Motor $\to$ Actuator Integration**:
    Simulates physical movement commands. The ESP32 maps the current/knob readings into joint angle commands $(0^\circ \text{ to } 180^\circ)$, steering the `wokwi-servo` to demonstrate physical control.
*   **PIR Motion Sensor $\to$ Workspace Proximity Barrier**:
    Defines a virtual boundary. If a human operator crosses the line and steps inside the arm's reach zone during an active trajectory, the PIR triggers a system halt command.
*   **MQ-2 Gas / Smoke Sensor $\to$ Fire Lockdown**:
    Electrical short-circuits in the control panel present fire risks. If the MQ-2 reads values $>3400$, the ESP32 registers critical danger, turns on the buzzer, displays `** ALARM **`, and sends an E-stop shutdown to the arm's controller.
*   **DHT22 Sensor $\to$ Heat Safety**:
    Maintains safe operation temperatures in base joints and component enclosures.

---

## 4. Software & Telemetry Sync Integration

At the end of every loop cycle, the ESP32 outputs metadata strings structured as clean JSON objects via Serial connection:
`{"temperature":24.5, "humidity":45.2, "motion":false, "light":1200, "smoke":2829, "current":1.45, "servoAngle":43, "alarm":false}`

*   **Integrated Wi-Fi Data Link**: On the physical ESP32, this JSON stream is broadcasted using built-in Wi-Fi (WebSockets / MQTT protocol) to sync data with the React Dashboard console.
*   **Status Interlock**: If the React controller parses `"alarm": true` (triggered by high smoke or button press), it locks the motion pipeline instantly, rejecting user keyboard or joystick actions.
