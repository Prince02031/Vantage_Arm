# GPIO Pin Mapping - Vantage Safety Watchdog

Below is the complete wiring register connecting the ESP32 DevKit V1 microcontroller to all sensor inputs and actuator output channels:

### 1. Actuators & Indicators
*   **Joint Servo Motor (`servo1`)**: `GPIO 13 (D13)` (PWM Output)
*   **Panic Buzzer (`buzzer1`)**: `GPIO 27 (D27)` (Digital Output)
*   **LED 1 (0.5A Limit - Green)**: `GPIO 16 (D16)` (Digital Output)
*   **LED 2 (1.5A Limit - Green)**: `GPIO 17 (D17)` (Digital Output)
*   **LED 3 (2.5A Limit - Yellow)**: `GPIO 18 (D18)` (Digital Output)
*   **LED 4 (3.5A Limit - Yellow)**: `GPIO 19 (D19)` (Digital Output)
*   **LED 5 (4.5A Limit - Red)**: `GPIO 23 (D23)` (Digital Output)
*   **LED 6 (5.5A Limit - Red)**: `GPIO 25 (D25)` (Digital Output)

### 2. Environmental & Safety Sensors
*   **DHT22 Temperature & Humidity**: `GPIO 15 (D15)` (Digital Input)
*   **PIR Motion / Proximity Sensor**: `GPIO 4 (D4)` (Digital Input)
*   **LDR Photoresistor (Ambient Light)**: `GPIO 34 (D34)` (Analog Input / ADC1_CH6)
*   **MQ-2 Gas / Smoke Sensor**: `GPIO 35 (D35)` (Analog Input / ADC1_CH7)
*   **ACS712 Current Potentiometer**: `GPIO 32 (D32)` (Analog Input / ADC1_CH4)

### 3. User Controls & Displays
*   **SSD1306 OLED SDA**: `GPIO 21 (D21)` (I2C SDA)
*   **SSD1306 OLED SCL**: `GPIO 22 (D22)` (I2C SCL)
*   **Manual E-Stop Pushbutton**: `GPIO 14 (D14)` (Digital Input, Active LOW via pull-up)
