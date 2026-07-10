/*
 * WattWatch - Smart Office Monitoring System
 * ESP32 DevKit V1 + DHT22 + PIR + LDR + MQ2 + Potentiometer (ACS712 substitute) + Servo Motor
 * OLED (SSD1306, I2C 0x3C) status display + Serial JSON telemetry + LED bank
 * representing 15 office devices, driven by simulated current draw.
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>
#include <ESP32Servo.h>

// ---------------- Pin assignment ----------------
#define DHTPIN        15
#define DHTTYPE       DHT22
#define PIR_PIN       4
#define LDR_PIN       34
#define MQ2_PIN       35
#define CURRENT_PIN   32   // Potentiometer stands in for ACS712 output
#define OLED_SDA      21
#define OLED_SCL      22
#define BUZZER_PIN    27
#define BUTTON_PIN    14
#define SERVO_PIN     13   // Joint Servo Motor Control Pin

#define LED1_PIN      16
#define LED2_PIN      17
#define LED3_PIN      18
#define LED4_PIN      19
#define LED5_PIN      23
#define LED6_PIN      25

// ---------------- OLED config ----------------
#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
#define OLED_ADDRESS  0x3C
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

DHT dht(DHTPIN, DHTTYPE);
Servo joint1;  // Joint servo motor object

// ---------------- Thresholds ----------------
const int   SMOKE_THRESHOLD_RAW = 3400; // out of 4095
const unsigned long UPDATE_INTERVAL_MS = 1000;

unsigned long lastUpdate = 0;
bool smokeAlarmActive = false;

// LED pins array for the 6 discrete indicator LEDs (mapped to current bands)
const int ledPins[6] = {LED1_PIN, LED2_PIN, LED3_PIN, LED4_PIN, LED5_PIN, LED6_PIN};

void setup() {
  Serial.begin(115200);
  delay(200);

  pinMode(PIR_PIN, INPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  for (int i = 0; i < 6; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);
  }

  analogReadResolution(12); // 0-4095

  dht.begin();

  // Joint Servo setup
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);
  joint1.setPeriodHertz(50);      // standard 50 Hz servo
  joint1.attach(SERVO_PIN, 500, 2400); // Standard min/max pulse values
  joint1.write(0);                // Initialize at 0 degrees

  Wire.begin(OLED_SDA, OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
    Serial.println("SSD1306 allocation failed");
  }
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("WattWatch Setup");
  display.println("Servo & Safety PoC");
  display.display();
  delay(500);
}

// Map raw ADC (0-4095) from the potentiometer to a simulated current in Amps (0-6A)
float readSimulatedCurrent() {
  int raw = analogRead(CURRENT_PIN);
  float current = (raw / 4095.0) * 6.0;
  return current;
}

// Drives the 6 status LEDs according to the current-band table in the spec
void updateLedBank(float current) {
  bool state[6] = {false, false, false, false, false, false};

  if (current < 0.5) {
    // all off
  } else if (current < 1.5) {
    state[0] = true;
  } else if (current < 2.5) {
    state[0] = state[1] = true;
  } else if (current < 3.5) {
    state[0] = state[1] = state[2] = true;
  } else if (current < 4.5) {
    state[0] = state[1] = state[2] = state[3] = true;
  } else if (current < 5.5) {
    state[0] = state[1] = state[2] = state[3] = state[4] = true;
  } else {
    state[0] = state[1] = state[2] = state[3] = state[4] = state[5] = true;
  }

  for (int i = 0; i < 6; i++) {
    digitalWrite(ledPins[i], state[i] ? HIGH : LOW);
  }
}

void updateOled(float temperature, float humidity, bool motion, int smoke, float current, bool alarm) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("WattWatch");
  display.drawLine(0, 9, SCREEN_WIDTH, 9, SSD1306_WHITE);

  display.setCursor(0, 14);
  if (isnan(temperature)) {
    display.println("Temp: --.- C");
  } else {
    display.print("Temp: ");
    display.print(temperature, 1);
    display.println(" C");
  }

  if (isnan(humidity)) {
    display.println("Hum:  --.- %");
  } else {
    display.print("Hum:  ");
    display.print(humidity, 1);
    display.println(" %");
  }

  display.print("Motion: ");
  display.println(motion ? "YES" : "no");

  display.print("Smoke:  ");
  display.println(smoke);

  display.print("Current:");
  display.print(current, 2);
  display.println(" A");

  if (alarm) {
    display.setCursor(0, 56);
    display.println("** ALARM **");
  }

  display.display();
}

void loop() {
  unsigned long now = millis();
  if (now - lastUpdate < UPDATE_INTERVAL_MS) {
    // Poll the button quickly for instant alarm responsiveness
    bool buttonPressed = (digitalRead(BUTTON_PIN) == LOW);
    bool alarm = buttonPressed || smokeAlarmActive;
    digitalWrite(BUZZER_PIN, alarm ? HIGH : LOW);
    return;
  }
  lastUpdate = now;

  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  bool motion = (digitalRead(PIR_PIN) == HIGH);
  int lightRaw = analogRead(LDR_PIN);
  int smokeRaw = analogRead(MQ2_PIN);
  float current = readSimulatedCurrent();
  bool buttonPressed = (digitalRead(BUTTON_PIN) == LOW);

  smokeAlarmActive = (smokeRaw > SMOKE_THRESHOLD_RAW);
  bool alarm = smokeAlarmActive || buttonPressed;
  digitalWrite(BUZZER_PIN, alarm ? HIGH : LOW);

  updateLedBank(current);
  updateOled(temperature, humidity, motion, smokeRaw, current, alarm);

  // Map current load (0-6A) to physical servo position angle (0 to 180 degrees)
  int servoAngle = map((int)(current * 100.0), 0, 600, 0, 180);
  joint1.write(servoAngle);

  // ---- Serial JSON telemetry ----
  Serial.print("{");
  Serial.print("\"temperature\":");
  Serial.print(isnan(temperature) ? 0.0 : temperature, 1);
  Serial.print(",\"humidity\":");
  Serial.print(isnan(humidity) ? 0.0 : humidity, 1);
  Serial.print(",\"motion\":");
  Serial.print(motion ? "true" : "false");
  Serial.print(",\"light\":");
  Serial.print(lightRaw);
  Serial.print(",\"smoke\":");
  Serial.print(smokeRaw);
  Serial.print(",\"current\":");
  Serial.print(current, 2);
  Serial.print(",\"servoAngle\":");
  Serial.print(servoAngle);
  Serial.print(",\"alarm\":");
  Serial.print(alarm ? "true" : "false");
  Serial.println("}");
}
