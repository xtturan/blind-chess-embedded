/*
 * BlindChess ESP8266 Firmware
 * 
 * Functions:
 * 1. WiFi Access Point (SSID: BlindChess, Pass: name12@@)
 * 2. HTTP Server on port 80 (serves web app from LittleFS)
 * 3. WebSocket Server on port 81 (button events + motor commands)
 * 4. Button input with tap/longpress detection
 * 5. PWM motor control via PN2222A transistor
 */

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <WebSocketsServer.h>
#include <LittleFS.h>
#include <ArduinoJson.h>

// ===== CONFIGURATION =====
const char* WIFI_SSID = "BlindChess";
const char* WIFI_PASS = "name12@@";
const int HTTP_PORT = 80;
const int WS_PORT = 81;

// ===== PIN DEFINITIONS =====
#define BUTTON_PIN 0      // GPIO0 = D3 on NodeMCU
#define MOTOR_PIN 14      // GPIO14 = D5 on NodeMCU (safe, not a boot strap)

// ===== TIMING CONSTANTS =====
#define DEBOUNCE_MS 10
#define LONGPRESS_MS 300
#define DOUBLETAP_MS 250
#define PANIC_HOLD_MS 15000

// ===== GLOBAL OBJECTS =====
ESP8266WebServer httpServer(HTTP_PORT);
WebSocketsServer webSocket(WS_PORT);

// ===== BUTTON STATE =====
volatile bool buttonPressed = false;
unsigned long buttonDownTime = 0;
unsigned long lastReleaseTime = 0;
unsigned long lastDebounceTime = 0;
unsigned long lastTapTime = 0;
bool lastButtonState = HIGH;
int tapCount = 0;
bool waitingForDoubleTap = false;
bool longPressFired = false;
bool panicFired = false;

// ===== MOTOR STATE =====
bool motorRunning = false;
unsigned long motorStopTime = 0;
int actualPWM = 0; // Current hardware PWM value for ramping
unsigned long lastRampTime = 0;
#define RAMP_STEP_MS 2

// ===== VIBRATION PATTERN =====
#define MAX_PATTERN_STEPS 120
// PWM mode is much quieter for smoothing than DC-chopping
#define DC_ONLY false
int vibrationPattern[MAX_PATTERN_STEPS];
int patternLength = 0;
int patternIndex = 0;
unsigned long patternStepTime = 0;
bool patternRunning = false;
int currentPWM = 75;  // Default ~30% intensity
int currentFreq = 150; // Default 150Hz PWM frequency for better shoe resonance

// ===== FUNCTION: Send JSON via WebSocket =====
void broadcastJSON(const char* type, const char* action = nullptr) {
  JsonDocument doc;
  doc["type"] = type;
  if (action) doc["action"] = action;
  
  String output;
  serializeJson(doc, output);
  webSocket.broadcastTXT(output);
  
  Serial.print("[WS] Broadcast: ");
  Serial.println(output);
}

// ===== FUNCTION: Start Vibration Pattern =====
void startVibrationPattern(int* pattern, int length, int pwm) {
  for (int i = 0; i < length && i < MAX_PATTERN_STEPS; i++) {
    vibrationPattern[i] = pattern[i];
  }
  patternLength = length > MAX_PATTERN_STEPS ? MAX_PATTERN_STEPS : length;
  patternIndex = 0;
  patternRunning = true;
  currentPWM = pwm;
  patternStepTime = millis();
  
  // Start first step (motor ON)
  pinMode(MOTOR_PIN, OUTPUT);
  // Use currentFreq for PWM frequency (set via WebSocket command)
  int freq = currentFreq > 0 ? currentFreq * 1000 : 1000; // Default 1kHz
  analogWriteFreq(freq);
  motorRunning = true;
  
  Serial.print("[MOTOR] Pattern started, length=");
  Serial.print(length);
  Serial.print(", PWM=");
  Serial.print(pwm);
  Serial.print(", freq=");
  Serial.println(freq);
}

// ===== FUNCTION: Update Vibration Pattern =====
void updateVibrationPattern() {
  unsigned long now = millis();

  // Handle ramping for "floating" smooth feel
  int targetPWM = 0;
  if (patternRunning && (patternIndex % 2 == 0)) {
    targetPWM = currentPWM;
  }

  if (now - lastRampTime >= RAMP_STEP_MS) {
    if (actualPWM < targetPWM) {
      actualPWM = min(targetPWM, actualPWM + 15); // Fast ramp up
    } else if (actualPWM > targetPWM) {
      actualPWM = max(targetPWM, actualPWM - 8);  // Slower ramp down for "float"
    }
    
    analogWrite(MOTOR_PIN, actualPWM);
    lastRampTime = now;
  }

  if (!patternRunning) return;
  
  if (now - patternStepTime >= static_cast<unsigned long>(vibrationPattern[patternIndex])) {
    patternIndex++;
    patternStepTime = now;
    
    if (patternIndex >= patternLength) {
      // Pattern complete
      patternRunning = false;
      Serial.println("[MOTOR] Pattern complete");
    }
  }
}

// ===== FUNCTION: Handle Button Logic =====
void handleButton() {
  bool reading = (digitalRead(BUTTON_PIN) == LOW);
  unsigned long now = millis();

  // Long press while held (even if bouncing)
  if (reading && buttonPressed && !longPressFired) {
    if ((now - buttonDownTime) >= LONGPRESS_MS) {
      broadcastJSON("button", "longpress");
      longPressFired = true;
      tapCount = 0;
      waitingForDoubleTap = false;
      Serial.println("[BTN] Long press fired");
    }
  }

  // Panic hold (30 seconds)
  if (reading && buttonPressed && !panicFired) {
    if ((now - buttonDownTime) >= PANIC_HOLD_MS) {
      broadcastJSON("button", "panic");
      panicFired = true;
      Serial.println("[BTN] Panic hold fired");
    }
  }

  // Debounce
  if (reading != lastButtonState) {
    lastDebounceTime = now;
  }

  if ((now - lastDebounceTime) < DEBOUNCE_MS) {
    lastButtonState = reading;
    return;
  }

  bool currentState = reading;
  lastButtonState = reading;
  
  // Button just pressed
  if (currentState && !buttonPressed) {
    buttonPressed = true;
    buttonDownTime = now;
    longPressFired = false;
    Serial.println("[BTN] Pressed");
  }

  // Button just released
  if (!currentState && buttonPressed) {
    buttonPressed = false;
    unsigned long pressDuration = now - buttonDownTime;
    Serial.print("[BTN] Released after ");
    Serial.print(pressDuration);
    Serial.println("ms");
    panicFired = false;

    if (!longPressFired) {
      // Short tap - Single tap only (double tap disabled)
      broadcastJSON("button", "tap");
      tapCount = 0;
      waitingForDoubleTap = false;
      Serial.println("[BTN] Single tap fired");
    }
  }
}

// ===== FUNCTION: WebSocket Event Handler =====
void webSocketEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.printf("[WS] Client %u disconnected\n", num);
      break;
      
    case WStype_CONNECTED:
      {
        IPAddress ip = webSocket.remoteIP(num);
        Serial.printf("[WS] Client %u connected from %s\n", num, ip.toString().c_str());
        
        // Send welcome status
        JsonDocument doc;
        doc["type"] = "status";
        doc["connected"] = true;
        doc["device"] = "ESP8266";
        doc["motor"] = true;
        
        String output;
        serializeJson(doc, output);
        webSocket.sendTXT(num, output);
      }
      break;
      
    case WStype_TEXT:
      {
        Serial.printf("[WS] Received: %s\n", payload);
        
        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, payload);
        
        if (error) {
          Serial.print("[WS] JSON parse error: ");
          Serial.println(error.c_str());
          return;
        }
        
        const char* msgType = doc["type"];
        
        if (strcmp(msgType, "vibrate") == 0) {
          // Handle vibration command
          JsonArray pattern = doc["pattern"];
          int pwm = doc["pwm"] | 75;  // Default PWM
          int freq = doc["freq"] | 30;  // Default frequency
          
          int tempPattern[MAX_PATTERN_STEPS];
          int len = 0;
          for (JsonVariant v : pattern) {
            if (len < MAX_PATTERN_STEPS) {
              tempPattern[len++] = v.as<int>();
            }
          }
          
          if (len > 0) {
            currentFreq = freq;
            startVibrationPattern(tempPattern, len, pwm);
          }
        }
        else if (strcmp(msgType, "reset") == 0) {
          // Disconnect all clients and reset button state
          for (uint8_t i = 0; i < WEBSOCKETS_SERVER_CLIENT_MAX; i++) {
            webSocket.disconnect(i);
          }
          buttonPressed = false;
          longPressFired = false;
          waitingForDoubleTap = false;
          tapCount = 0;
          Serial.println("[WS] Reset requested");
        }
        else if (strcmp(msgType, "ping") == 0) {
          // Respond to ping
          webSocket.sendTXT(num, "{\"type\":\"pong\"}");
        }
      }
      break;
    case WStype_ERROR:
    case WStype_BIN:
    case WStype_FRAGMENT_TEXT_START:
    case WStype_FRAGMENT_BIN_START:
    case WStype_FRAGMENT:
    case WStype_FRAGMENT_FIN:
    case WStype_PING:
    case WStype_PONG:
      break;
  }
}

// ===== FUNCTION: Get MIME Type =====
String getContentType(String filename) {
  if (filename.endsWith(".html")) return "text/html";
  if (filename.endsWith(".css")) return "text/css";
  if (filename.endsWith(".js")) return "application/javascript";
  if (filename.endsWith(".wasm")) return "application/wasm";
  if (filename.endsWith(".ico")) return "image/x-icon";
  if (filename.endsWith(".svg")) return "image/svg+xml";
  if (filename.endsWith(".json")) return "application/json";
  if (filename.endsWith(".woff")) return "font/woff";
  if (filename.endsWith(".woff2")) return "font/woff2";
  return "text/plain";
}

// ===== FUNCTION: Serve File from LittleFS =====
bool handleFileRead(String path) {
  Serial.print("[HTTP] Request: ");
  Serial.println(path);

  int qIndex = path.indexOf('?');
  if (qIndex >= 0) {
    path = path.substring(0, qIndex);
  }
  
  if (path.endsWith("/")) path += "index.html";
  
  String contentType = getContentType(path);
  String pathWithGz = path + ".gz";

  if (LittleFS.exists(pathWithGz)) {
    File file = LittleFS.open(pathWithGz, "r");
    httpServer.sendHeader("Content-Encoding", "gzip");
    httpServer.streamFile(file, contentType);
    file.close();
    Serial.println("[HTTP] File sent (gzip)");
    return true;
  }

  if (LittleFS.exists(path)) {
    File file = LittleFS.open(path, "r");
    httpServer.streamFile(file, contentType);
    file.close();
    Serial.println("[HTTP] File sent");
    return true;
  }
  
  // Try with .html extension only if no extension present
  int lastSlash = path.lastIndexOf('/');
  int lastDot = path.lastIndexOf('.');
  bool hasExtension = (lastDot > lastSlash);
  if (!hasExtension) {
    String htmlPath = path + ".html";
    if (LittleFS.exists(htmlPath)) {
      File file = LittleFS.open(htmlPath, "r");
      httpServer.streamFile(file, contentType);
      file.close();
      return true;
    }
  }
  
  Serial.println("[HTTP] File not found");
  return false;
}

// ===== SETUP =====
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n\n=== BlindChess ESP8266 Starting ===");
  
  // Initialize pins
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(MOTOR_PIN, OUTPUT);
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH); // turn off onboard LED (active low)
  
  analogWriteRange(255);
  analogWriteFreq(40000); // 40kHz is way above human hearing - perfect for silent smoothing
  analogWrite(MOTOR_PIN, 0);
  
  // Initialize LittleFS
  if (!LittleFS.begin()) {
    Serial.println("[ERROR] LittleFS mount failed!");
    return;
  }
  Serial.println("[LittleFS] Mounted successfully");
  
  // List files in LittleFS
  Dir dir = LittleFS.openDir("/");
  Serial.println("[LittleFS] Files:");
  while (dir.next()) {
    Serial.print("  ");
    Serial.print(dir.fileName());
    Serial.print(" - ");
    Serial.print(dir.fileSize());
    Serial.println(" bytes");
  }
  
  // Start WiFi Access Point
  WiFi.mode(WIFI_AP);
  WiFi.softAP(WIFI_SSID, WIFI_PASS);
  delay(200); // Give radio time to stabilize
  Serial.print("[WIFI] AP started: ");
  Serial.println(WIFI_SSID);
  Serial.print("[WIFI] IP: ");
  Serial.println(WiFi.softAPIP());
  
  // Start WebSocket server
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
  Serial.println("[WS] Server started on port 81");
  
  // Setup HTTP routes
  httpServer.onNotFound([]() {
    if (!handleFileRead(httpServer.uri())) {
      // Fallback to index.html for SPA routing
      handleFileRead("/index.html");
    }
  });
  
  httpServer.begin();
  Serial.println("[HTTP] Server started on port 80");
  
  // Startup vibration disabled for speaker silence
  
  Serial.println("=== BlindChess Ready ===\n");
}

// ===== LOOP =====
void loop() {
  httpServer.handleClient();
  webSocket.loop();
  handleButton();
  updateVibrationPattern();
}
