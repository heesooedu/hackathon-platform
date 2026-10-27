'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

export type PhysicalBoardType = 'microbit' | 'arduino_uno' | 'rpi_pico';

export type VirtualComponentType =
  | 'led'
  | 'traffic_light'
  | 'buzzer'
  | 'servo'
  | 'button'
  | 'potentiometer'
  | 'ultrasonic'
  | 'light_sensor'
  | 'temp_sensor';

export type LedColorOption = 'red' | 'yellow' | 'green' | 'blue' | 'white';

export interface VirtualComponent {
  id: string;
  type: VirtualComponentType;
  label: string;
  pin: string;
  extraPin?: string; // 초음파 Echo 핀, 신호등 보조 핀 등
  color?: LedColorOption;
}

export interface PhysicalCircuitConfig {
  board: PhysicalBoardType;
  components: VirtualComponent[];
  missionPrompt?: string;
}

export interface PhysicalTemplateItem {
  id: string;
  board: PhysicalBoardType;
  label: string;
  caption: string;
  config: PhysicalCircuitConfig;
  code: string;
}

export const BOARD_META: Record<
  PhysicalBoardType,
  {
    label: string;
    shortLabel: string;
    badge: string;
    mcu: string;
    languageLabel: string;
    availablePins: string[];
    defaultExternalSimulatorUrl: string;
    externalSimulatorLabel: string;
  }
> = {
  microbit: {
    label: 'BBC micro:bit V2 (MicroPython)',
    shortLabel: '마이크로비트',
    badge: '🤖 micro:bit',
    mcu: 'Nordic nRF52833 · 5×5 LED 매트릭스 · A/B 버튼 · 내장 센서',
    languageLabel: 'MicroPython (microbit)',
    availablePins: ['P0', 'P1', 'P2', 'P8', 'P12', 'P16'],
    defaultExternalSimulatorUrl: 'https://python.microbit.org/v/3',
    externalSimulatorLabel: 'micro:bit Python 에디터 열기',
  },
  arduino_uno: {
    label: 'Arduino Uno R3 (C/C++)',
    shortLabel: '아두이노 Uno',
    badge: '♾️ Arduino Uno',
    mcu: 'ATmega328P · 디지털 D0~D13 (PWM ~) · 아날로그 A0~A5',
    languageLabel: 'Arduino C/C++ (setup / loop)',
    availablePins: [
      'D2',
      'D3',
      'D4',
      'D5',
      'D6',
      'D7',
      'D8',
      'D9',
      'D10',
      'D11',
      'D12',
      'D13',
      'A0',
      'A1',
      'A2',
      'A3',
    ],
    defaultExternalSimulatorUrl: 'https://www.tinkercad.com/circuits',
    externalSimulatorLabel: 'Tinkercad Circuits 열기',
  },
  rpi_pico: {
    label: 'Raspberry Pi Pico (MicroPython)',
    shortLabel: '라즈베리파이 피코',
    badge: '🍓 RPi Pico',
    mcu: 'RP2040 듀얼코어 · GP0~GP28 · ADC0~ADC2 (GP26~28)',
    languageLabel: 'MicroPython (machine.Pin / PWM / ADC)',
    availablePins: [
      'GP0',
      'GP1',
      'GP2',
      'GP13',
      'GP14',
      'GP15',
      'GP16',
      'GP17',
      'GP25',
      'GP26',
      'GP27',
      'GP28',
    ],
    defaultExternalSimulatorUrl: 'https://wokwi.com/pi-pico',
    externalSimulatorLabel: 'Wokwi Pi Pico 시뮬레이터 열기',
  },
};

export const COMPONENT_CATALOG: {
  type: VirtualComponentType;
  label: string;
  icon: string;
  ioType: '출력(Actuator)' | '입력(Sensor)';
  defaultPinByBoard: Record<PhysicalBoardType, { pin: string; extraPin?: string }>;
  powerGuide: string;
  wiringNote: string;
}[] = [
  {
    type: 'led',
    label: 'LED (발광 다이오드)',
    icon: '💡',
    ioType: '출력(Actuator)',
    defaultPinByBoard: {
      microbit: { pin: 'P0' },
      arduino_uno: { pin: 'D13' },
      rpi_pico: { pin: 'GP15' },
    },
    powerGuide: '애노드(+) → 신호 핀 (220Ω 저항 직렬), 캐소드(-) → GND',
    wiringNote: '긴 다리(+)를 디지털/PWM 출력 핀에, 짧은 다리(-)를 GND에 연결합니다.',
  },
  {
    type: 'traffic_light',
    label: '3색 신호등 모듈 (R·Y·G)',
    icon: '🚦',
    ioType: '출력(Actuator)',
    defaultPinByBoard: {
      microbit: { pin: 'P0', extraPin: 'P1,P2' },
      arduino_uno: { pin: 'D8', extraPin: 'D9,D10' },
      rpi_pico: { pin: 'GP13', extraPin: 'GP14,GP15' },
    },
    powerGuide: 'R·Y·G 각 신호 핀 연결, 공통 음극(GND) → 보드 GND',
    wiringNote: '빨강·노랑·초록 3개 핀을 순서대로 디지털 출력 핀에 배선합니다.',
  },
  {
    type: 'buzzer',
    label: '피에조 부저 (Piezo Buzzer)',
    icon: '🔊',
    ioType: '출력(Actuator)',
    defaultPinByBoard: {
      microbit: { pin: 'P0' },
      arduino_uno: { pin: 'D8' },
      rpi_pico: { pin: 'GP16' },
    },
    powerGuide: '(+) 단자 → PWM/디지털 핀, (-) 단자 → GND',
    wiringNote: '주파수(Hz)에 따라 도레미 음계나 경보음을 출력합니다.',
  },
  {
    type: 'servo',
    label: '서보모터 (SG90 0°~180°)',
    icon: '🦾',
    ioType: '출력(Actuator)',
    defaultPinByBoard: {
      microbit: { pin: 'P1' },
      arduino_uno: { pin: 'D9' },
      rpi_pico: { pin: 'GP17' },
    },
    powerGuide: '주황(Signal) → PWM 핀, 빨강(VCC) → 5V/3V3, 갈색(GND) → GND',
    wiringNote: 'PWM 펄스 폭으로 0°~180° 회전 각도를 정밀 제어합니다.',
  },
  {
    type: 'button',
    label: '푸시버튼 스위치',
    icon: '🔘',
    ioType: '입력(Sensor)',
    defaultPinByBoard: {
      microbit: { pin: 'P2' },
      arduino_uno: { pin: 'D2' },
      rpi_pico: { pin: 'GP14' },
    },
    powerGuide: '한쪽 단자 → 디지털 입력 핀, 반대쪽 → VCC 또는 GND (풀다운/풀업)',
    wiringNote: '버튼을 누를 때 HIGH(1) 또는 LOW(0) 디지털 신호를 읽습니다.',
  },
  {
    type: 'potentiometer',
    label: '가변저항 (다이얼 센서)',
    icon: '🎛️',
    ioType: '입력(Sensor)',
    defaultPinByBoard: {
      microbit: { pin: 'P1' },
      arduino_uno: { pin: 'A0' },
      rpi_pico: { pin: 'GP26' },
    },
    powerGuide: '양끝 단자 → VCC / GND, 가운데(Wiper) 단자 → 아날로그 입력(ADC) 핀',
    wiringNote: '다이얼 회전량에 따라 연속적인 전압 값(ADC)을 읽어 들입니다.',
  },
  {
    type: 'ultrasonic',
    label: '초음파 거리 센서 (HC-SR04)',
    icon: '📡',
    ioType: '입력(Sensor)',
    defaultPinByBoard: {
      microbit: { pin: 'P1', extraPin: 'P2' },
      arduino_uno: { pin: 'D9', extraPin: 'D10' },
      rpi_pico: { pin: 'GP14', extraPin: 'GP15' },
    },
    powerGuide: 'VCC → 5V/3V3, Trig → 출력 핀, Echo → 입력 핀, GND → GND',
    wiringNote: 'Trig로 초음파를 발사하고 Echo 반사 시간으로 거리(cm)를 계산합니다.',
  },
  {
    type: 'light_sensor',
    label: '조도 센서 (빛 밝기 감지)',
    icon: '☀️',
    ioType: '입력(Sensor)',
    defaultPinByBoard: {
      microbit: { pin: 'P2' },
      arduino_uno: { pin: 'A1' },
      rpi_pico: { pin: 'GP27' },
    },
    powerGuide: 'VCC → 5V/3V3, OUT → 아날로그 입력(ADC) 핀, GND → GND',
    wiringNote: '주변 빛의 밝기가 어두워지거나 밝아질 때 아날로그 값을 측정합니다.',
  },
  {
    type: 'temp_sensor',
    label: '온도 센서 (TMP36 / 내장 온도)',
    icon: '🌡️',
    ioType: '입력(Sensor)',
    defaultPinByBoard: {
      microbit: { pin: 'P1' },
      arduino_uno: { pin: 'A2' },
      rpi_pico: { pin: 'GP28' },
    },
    powerGuide: 'VCC → 3V3/5V, VOUT → 아날로그 입력(ADC) 핀, GND → GND',
    wiringNote: '현재 섭씨온도(°C)를 읽어 기준 온도 이상일 때 경보/팬을 작동시킵니다.',
  },
];

export const PHYSICAL_COMPUTING_TEMPLATES: PhysicalTemplateItem[] = [
  // 1. BBC micro:bit V2 Templates
  {
    id: 'microbit_heart_buttons',
    board: 'microbit',
    label: '🤖 [마이크로비트] A/B 버튼 & 5×5 하트·미소 매트릭스',
    caption: 'BBC micro:bit V2 — 버튼 입력과 5×5 LED 아이콘 제어 실습',
    config: {
      board: 'microbit',
      missionPrompt:
        '버튼 A를 누르면 하트(HEART)가 켜지고, 버튼 B를 누르면 웃는 얼굴(HAPPY)과 함께 P0 부저에서 경쾌한 소리가 나도록 코드를 실행해 보세요!',
      components: [
        { id: 'cmp-mb-buzzer', type: 'buzzer', label: '피에조 부저', pin: 'P0' },
        {
          id: 'cmp-mb-led',
          type: 'led',
          label: '외부 상태 LED',
          pin: 'P1',
          color: 'red',
        },
      ],
    },
    code: `from microbit import *
import music

# [실습 1] A, B 버튼 입력에 따라 5x5 LED 아이콘과 P0 부저 제어하기
while True:
    if button_a.is_pressed():
        display.show(Image.HEART)
        pin1.write_digital(1)
        music.pitch(523, 200)  # 523Hz (도)
        print("Button A 눌림 -> HEART 표시 & P1 LED ON")
    elif button_b.is_pressed():
        display.show(Image.HAPPY)
        pin1.write_digital(0)
        music.pitch(659, 200)  # 659Hz (미)
        print("Button B 눌림 -> HAPPY 표시")
    else:
        display.show(Image.SMALL_HEART)
        pin1.write_digital(0)
    sleep(200)`,
  },
  {
    id: 'microbit_light_nightlamp',
    board: 'microbit',
    label: '🤖 [마이크로비트] 조도·온도 센서 스마트 무드등',
    caption: 'BBC micro:bit V2 — 빛 밝기(light_level) 자동 야간 가로등 & 온도 경보',
    config: {
      board: 'microbit',
      missionPrompt:
        '조도 센서 슬라이더를 100 미만으로 낮추면 자동으로 P0 노란색 가로등이 켜지고, 온도가 30°C 이상이면 경고음(P2 부저)이 울리는지 확인해 보세요.',
      components: [
        {
          id: 'cmp-mb-lamp',
          type: 'led',
          label: '스마트 가로등 LED',
          pin: 'P0',
          color: 'yellow',
        },
        {
          id: 'cmp-mb-light',
          type: 'light_sensor',
          label: '주변 밝기(조도) 센서',
          pin: 'P1',
        },
        {
          id: 'cmp-mb-temp',
          type: 'temp_sensor',
          label: '실내 온도 센서',
          pin: 'P2',
        },
      ],
    },
    code: `from microbit import *

# [실습 2] 조도 센서(어두움 감지) 자동 가로등 & 고온 알림 시스템
while True:
    light = display.read_light_level()
    temp = temperature()
    print(f"현재 밝기: {light}, 온도: {temp}°C")

    if light < 100:
        # 주변이 어두우면 가로등(P0) 자동 점등
        pin0.write_digital(1)
        display.show(Image.YES)
    else:
        # 주변이 밝으면 가로등 소등 (에너지 절약)
        pin0.write_digital(0)
        display.show(Image.HAPPY)

    if temp >= 30:
        display.show(Image.SAD)
        print("⚠️ 고온 주의보 발생!")
    sleep(300)`,
  },
  {
    id: 'microbit_barrier_servo',
    board: 'microbit',
    label: '🤖 [마이크로비트] 초음파 감지 스마트 주차 차단기',
    caption: 'BBC micro:bit V2 — 차량 접근 감지 서보모터(P1) 차단기 제어',
    config: {
      board: 'microbit',
      missionPrompt:
        '초음파 거리 센서 슬라이더를 25cm 이하로 가까이 이동시켜 서보모터 차단기가 90°로 열리고 초록불(P0)이 켜지는지 실험해 보세요.',
      components: [
        {
          id: 'cmp-mb-green',
          type: 'led',
          label: '진입 안내 녹색 LED',
          pin: 'P0',
          color: 'green',
        },
        {
          id: 'cmp-mb-servo',
          type: 'servo',
          label: '차단기 서보모터',
          pin: 'P1',
        },
        {
          id: 'cmp-mb-ultra',
          type: 'ultrasonic',
          label: '초음파 거리 센서',
          pin: 'P2',
          extraPin: 'P8',
        },
      ],
    },
    code: `from microbit import *

# [실습 3] 초음파 거리 센서 기반 스마트 주차 차단기
while True:
    # 초음파 센서 측정 거리 (cm)
    if distance < 25:
        pin0.write_digital(1)
        pin1.write_analog(90)  # 서보모터 90도 열림
        display.show(Image.YES)
        print(f"차량 감지 ({distance}cm) -> 차단기 열림 (90°)")
    else:
        pin0.write_digital(0)
        pin1.write_analog(0)   # 서보모터 0도 닫힘
        display.show(Image.NO)
        print(f"대기 중 ({distance}cm) -> 차단기 닫힘 (0°)")
    sleep(300)`,
  },

  // 2. Arduino Uno R3 Templates
  {
    id: 'arduino_traffic_blink',
    board: 'arduino_uno',
    label: '♾️ [아두이노 Uno] 3색 신호등 & 보행자 버튼 제어',
    caption: 'Arduino Uno R3 — 디지털 출력(digitalWrite)과 보행자 푸시버튼 신호등',
    config: {
      board: 'arduino_uno',
      missionPrompt:
        '평소에는 빨간불→노란불→초록불이 순차 점멸하다가, 보행자 버튼(D2)을 누르면 즉시 초록불(D10)과 안내음(D6 부저)이 켜지도록 실습해 보세요.',
      components: [
        {
          id: 'cmp-ard-tl',
          type: 'traffic_light',
          label: '3색 신호등 (R:D8, Y:D9, G:D10)',
          pin: 'D8',
          extraPin: 'D9,D10',
        },
        {
          id: 'cmp-ard-btn',
          type: 'button',
          label: '보행자 횡단 버튼',
          pin: 'D2',
        },
        {
          id: 'cmp-ard-buz',
          type: 'buzzer',
          label: '횡단보도 안내 부저',
          pin: 'D6',
        },
      ],
    },
    code: `// [아두이노 실습 1] 보행자 버튼 연동 3색 스마트 신호등 제어
const int RED_PIN = 8;
const int YELLOW_PIN = 9;
const int GREEN_PIN = 10;
const int BTN_PIN = 2;
const int BUZZER_PIN = 6;

void setup() {
    Serial.begin(9600);
    pinMode(RED_PIN, OUTPUT);
    pinMode(YELLOW_PIN, OUTPUT);
    pinMode(GREEN_PIN, OUTPUT);
    pinMode(BTN_PIN, INPUT);
    pinMode(BUZZER_PIN, OUTPUT);
}

void loop() {
    int btnState = digitalRead(BTN_PIN);

    if (btnState == HIGH) {
        // 보행자 버튼이 눌리면 초록불 점등 및 안내음 출력
        digitalWrite(RED_PIN, LOW);
        digitalWrite(YELLOW_PIN, LOW);
        digitalWrite(GREEN_PIN, HIGH);
        tone(BUZZER_PIN, 880, 200);
        Serial.println("보행자 버튼 입력! -> 녹색 횡단 신호 점등");
    } else {
        // 기본 순차 신호등 사이클 작동
        digitalWrite(RED_PIN, HIGH);
        digitalWrite(YELLOW_PIN, LOW);
        digitalWrite(GREEN_PIN, LOW);
        noTone(BUZZER_PIN);
        Serial.println("차량 주행 대기 (적색/녹색 순환 중)");
    }
    delay(400);
}`,
  },
  {
    id: 'arduino_ultrasonic_parking',
    board: 'arduino_uno',
    label: '♾️ [아두이노 Uno] 초음파 후방 경보기 & 서보 게이트',
    caption: 'Arduino Uno R3 — HC-SR04 초음파 거리 측정 + 피에조 부저 + 서보모터',
    config: {
      board: 'arduino_uno',
      missionPrompt:
        '초음파 거리 센서(HC-SR04) 슬라이더를 조절해 거리가 20cm 미만일 때 경고음(D8)과 빨간불(D13)이 켜지고 서보모터(D11)가 90°로 움직이는지 확인하세요.',
      components: [
        {
          id: 'cmp-ard-ultra',
          type: 'ultrasonic',
          label: '초음파 센서 HC-SR04 (Trig:D9, Echo:D10)',
          pin: 'D9',
          extraPin: 'D10',
        },
        {
          id: 'cmp-ard-servo',
          type: 'servo',
          label: '차단기 서보모터',
          pin: 'D11',
        },
        {
          id: 'cmp-ard-buzzer',
          type: 'buzzer',
          label: '후방 경보 피에조 부저',
          pin: 'D8',
        },
        {
          id: 'cmp-ard-led',
          type: 'led',
          label: '위험 경고 LED',
          pin: 'D13',
          color: 'red',
        },
      ],
    },
    code: `#include <Servo.h>

// [아두이노 실습 2] 초음파 거리 센서(HC-SR04) 경보기 & 서보 게이트
const int TRIG_PIN = 9;
const int ECHO_PIN = 10;
const int BUZZER_PIN = 8;
const int LED_PIN = 13;
Servo gateServo;

void setup() {
    Serial.begin(9600);
    pinMode(TRIG_PIN, OUTPUT);
    pinMode(ECHO_PIN, INPUT);
    pinMode(BUZZER_PIN, OUTPUT);
    pinMode(LED_PIN, OUTPUT);
    gateServo.attach(11);
}

void loop() {
    // 초음파 센서 측정 거리(distance, 단위: cm)에 따른 조건문 제어
    if (distance < 20) {
        digitalWrite(LED_PIN, HIGH);
        tone(BUZZER_PIN, 988, 200);
        gateServo.write(90);
        Serial.println("근접 감지 (<20cm)! 경보음 ON & 게이트 90도 개방");
    } else if (distance < 50) {
        digitalWrite(LED_PIN, HIGH);
        tone(BUZZER_PIN, 523, 150);
        gateServo.write(45);
        Serial.println("주의 거리 (<50cm) 접근 중");
    } else {
        digitalWrite(LED_PIN, LOW);
        noTone(BUZZER_PIN);
        gateServo.write(0);
        Serial.println("안전 거리 유지 중 -> 게이트 0도 닫힘");
    }
    delay(300);
}`,
  },
  {
    id: 'arduino_pot_pwm',
    board: 'arduino_uno',
    label: '♾️ [아두이노 Uno] 가변저항(A0) 아날로그 입력 & PWM 밝기 조절',
    caption: 'Arduino Uno R3 — analogRead(A0)와 analogWrite(PWM) 무드등 & 서보 제어',
    config: {
      board: 'arduino_uno',
      missionPrompt:
        '가변저항(A0) 다이얼 슬라이더를 0~1023 사이로 움직여 D9 파란색 LED의 PWM 밝기(0~255)와 서보모터(D6) 회전 각도(0°~180°)가 비례하여 변하는 것을 관찰하세요.',
      components: [
        {
          id: 'cmp-ard-pot',
          type: 'potentiometer',
          label: '가변저항 다이얼 (0~1023)',
          pin: 'A0',
        },
        {
          id: 'cmp-ard-pwmled',
          type: 'led',
          label: 'PWM 밝기 조절 LED',
          pin: 'D9',
          color: 'blue',
        },
        {
          id: 'cmp-ard-servo2',
          type: 'servo',
          label: '각도 연동 서보모터',
          pin: 'D6',
        },
      ],
    },
    code: `#include <Servo.h>

// [아두이노 실습 3] 가변저항(A0) 아날로그 값으로 PWM LED 밝기와 서보 각도 제어
const int POT_PIN = A0;
const int LED_PIN = 9;
Servo myServo;

void setup() {
    Serial.begin(9600);
    pinMode(LED_PIN, OUTPUT);
    myServo.attach(6);
}

void loop() {
    int sensorVal = analogRead(A0);           // 0 ~ 1023 아날로그 입력
    int pwmVal = map(sensorVal, 0, 1023, 0, 255);     // 0 ~ 255 PWM 변환
    int angle = map(sensorVal, 0, 1023, 0, 180);      // 0 ~ 180도 각도 변환

    analogWrite(LED_PIN, pwmVal);
    myServo.write(angle);
    Serial.println("A0 입력 및 PWM/서보 출력 갱신 완료");
    delay(250);
}`,
  },

  // 3. Raspberry Pi Pico Templates
  {
    id: 'pico_gpio_traffic',
    board: 'rpi_pico',
    label: '🍓 [라즈베리파이 피코] GPIO 신호등 & 버튼 인터럽트 실습',
    caption: 'Raspberry Pi Pico — machine.Pin 디지털 입출력 제어 실습',
    config: {
      board: 'rpi_pico',
      missionPrompt:
        '라즈베리파이 피코의 GP13(빨강), GP14(노랑), GP15(초록) 신호등과 GP16 푸시버튼의 동작을 확인하고 코드를 수정해 보세요.',
      components: [
        {
          id: 'cmp-pico-tl',
          type: 'traffic_light',
          label: '3색 신호등 (GP13·GP14·GP15)',
          pin: 'GP13',
          extraPin: 'GP14,GP15',
        },
        {
          id: 'cmp-pico-btn',
          type: 'button',
          label: '보행자 푸시버튼',
          pin: 'GP16',
        },
        {
          id: 'cmp-pico-onboard',
          type: 'led',
          label: '내장/외부 상태 LED',
          pin: 'GP25',
          color: 'green',
        },
      ],
    },
    code: `from machine import Pin
import utime

# [피코 실습 1] machine.Pin을 활용한 GPIO 디지털 입출력 제어
red_led = Pin(13, Pin.OUT)
yellow_led = Pin(14, Pin.OUT)
green_led = Pin(15, Pin.OUT)
onboard_led = Pin(25, Pin.OUT)
button = Pin(16, Pin.IN, Pin.PULL_DOWN)

while True:
    if button.value() == 1:
        red_led.value(0)
        yellow_led.value(0)
        green_led.value(1)
        onboard_led.value(1)
        print("[Pico REPL] 버튼 감지(GP16=1) -> 녹색불(GP15) 점등!")
    else:
        onboard_led.value(1)
        print("[Pico REPL] 기본 신호등 순환 작동 중...")
    utime.sleep(0.4)`,
  },
  {
    id: 'pico_adc_pwm',
    board: 'rpi_pico',
    label: '🍓 [라즈베리파이 피코] 16비트 ADC(GP26) & PWM 부저·LED 제어',
    caption: 'Raspberry Pi Pico — machine.ADC(26) 아날로그 읽기와 PWM 듀티비 제어',
    config: {
      board: 'rpi_pico',
      missionPrompt:
        '피코의 16비트 ADC(GP26, 0~65535) 가변저항 값을 조절하여 GP15 LED 밝기와 GP16 PWM 부저 소리가 어떻게 달라지는지 확인해 보세요.',
      components: [
        {
          id: 'cmp-pico-pot',
          type: 'potentiometer',
          label: '가변저항 (ADC0 / GP26)',
          pin: 'GP26',
        },
        {
          id: 'cmp-pico-led',
          type: 'led',
          label: 'PWM 그린 LED',
          pin: 'GP15',
          color: 'green',
        },
        {
          id: 'cmp-pico-buz',
          type: 'buzzer',
          label: 'PWM 부저',
          pin: 'GP16',
        },
      ],
    },
    code: `from machine import Pin, PWM, ADC
import utime

# [피코 실습 2] ADC0(GP26) 16비트 아날로그 입력 & PWM 출력
adc = ADC(Pin(26))
pwm_led = PWM(Pin(15))
pwm_led.freq(1000)
buzzer = PWM(Pin(16))

while True:
    raw_u16 = adc.read_u16()  # 0 ~ 65535
    pwm_led.duty_u16(raw_u16)

    if raw_u16 > 40000:
        buzzer.freq(784)      # 784Hz (솔) 경보음
        buzzer.duty_u16(32768)
        print(f"ADC={raw_u16} (높음) -> PWM 부저 경보 울림")
    else:
        buzzer.duty_u16(0)
        print(f"ADC={raw_u16} -> LED 듀티비 정상 제어")
    utime.sleep(0.3)`,
  },
  {
    id: 'pico_smart_farm',
    board: 'rpi_pico',
    label: '🍓 [라즈베리파이 피코] 스마트팜 온습도·조도 자동 환기창 제어',
    caption: 'Raspberry Pi Pico — 온도(GP28)·조도(GP27) 센서 기반 서보 환기창 & 생장 LED',
    config: {
      board: 'rpi_pico',
      missionPrompt:
        '스마트팜 실습: 온도가 28°C 이상이면 환기창 서보모터(GP17)가 90°로 열리고, 조도가 100 미만이면 식물 생장용 보라/파란색 LED(GP15)가 켜지도록 테스트하세요.',
      components: [
        {
          id: 'cmp-pico-temp',
          type: 'temp_sensor',
          label: '온실 온도 센서 (ADC2)',
          pin: 'GP28',
        },
        {
          id: 'cmp-pico-light',
          type: 'light_sensor',
          label: '일조량 조도 센서 (ADC1)',
          pin: 'GP27',
        },
        {
          id: 'cmp-pico-servo',
          type: 'servo',
          label: '천장 환기창 서보모터',
          pin: 'GP17',
        },
        {
          id: 'cmp-pico-growled',
          type: 'led',
          label: '식물 생장 LED',
          pin: 'GP15',
          color: 'blue',
        },
      ],
    },
    code: `from machine import Pin, PWM, ADC
import utime

# [피코 실습 3] 스마트팜 자동 환경 제어 (온도 환기창 + 일조량 생장 LED)
grow_led = Pin(15, Pin.OUT)
window_servo = PWM(Pin(17))
window_servo.freq(50)

while True:
    if temp >= 28:
        # 온실 온도가 28도 이상이면 천장 환기창 개방 (90도)
        window_servo.duty_u16(4915)
        print(f"[SmartFarm] 고온({temp}°C) 감지 -> 환기창 90° 개방")
    else:
        window_servo.duty_u16(1638)
        print(f"[SmartFarm] 적정 온도({temp}°C) -> 환기창 닫힘")

    if light < 100:
        grow_led.value(1)
        print(f"[SmartFarm] 일조량 부족(밝기 {light}) -> 식물 생장 LED ON")
    else:
        grow_led.value(0)
    utime.sleep(0.4)`,
  },
];

const CONFIG_PREFIX = '<!--physical-config:';
const CONFIG_SUFFIX = '-->';

export function parsePhysicalBlockContent(rawContent: string): {
  config: PhysicalCircuitConfig;
  code: string;
} {
  const normalized = (rawContent || '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const firstLine = (lines[0] || '').trim();

  if (firstLine.startsWith(CONFIG_PREFIX) && firstLine.endsWith(CONFIG_SUFFIX)) {
    const jsonPart = firstLine
      .slice(CONFIG_PREFIX.length, firstLine.length - CONFIG_SUFFIX.length)
      .trim();
    try {
      const parsed = JSON.parse(jsonPart) as Partial<PhysicalCircuitConfig>;
      const board: PhysicalBoardType =
        parsed.board === 'microbit' ||
        parsed.board === 'arduino_uno' ||
        parsed.board === 'rpi_pico'
          ? parsed.board
          : 'arduino_uno';
      const components = Array.isArray(parsed.components)
        ? parsed.components
        : PHYSICAL_COMPUTING_TEMPLATES[3].config.components;
      return {
        config: {
          board,
          components,
          missionPrompt: parsed.missionPrompt || '',
        },
        code: lines.slice(1).join('\n'),
      };
    } catch {
      // 파싱 실패 시 아래 자동 추론으로 진행
    }
  }

  // 메타 주석이 없을 경우 코드 문법으로 보드 종류 자동 추론
  const codeText = normalized.trim();
  if (
    codeText.includes('from microbit') ||
    codeText.includes('display.show') ||
    codeText.includes('button_a')
  ) {
    return {
      config: PHYSICAL_COMPUTING_TEMPLATES[0].config,
      code: codeText || PHYSICAL_COMPUTING_TEMPLATES[0].code,
    };
  }
  if (
    codeText.includes('from machine import') ||
    codeText.includes('utime') ||
    codeText.includes('duty_u16')
  ) {
    return {
      config: PHYSICAL_COMPUTING_TEMPLATES[6].config,
      code: codeText || PHYSICAL_COMPUTING_TEMPLATES[6].code,
    };
  }

  // 기본값: 아두이노 Uno 또는 마이크로비트 첫 번째 템플릿
  if (!codeText) {
    return {
      config: PHYSICAL_COMPUTING_TEMPLATES[0].config,
      code: PHYSICAL_COMPUTING_TEMPLATES[0].code,
    };
  }

  return {
    config: PHYSICAL_COMPUTING_TEMPLATES[3].config,
    code: codeText,
  };
}

export function serializePhysicalBlockContent(
  config: PhysicalCircuitConfig,
  code: string
): string {
  const cleanCode = (code || '').replace(/\r\n/g, '\n');
  // 만약 cleanCode 첫 줄에 이미 <!--physical-config:...-->가 있으면 제거
  const lines = cleanCode.split('\n');
  const bodyCode =
    lines[0]?.trim().startsWith(CONFIG_PREFIX)
      ? lines.slice(1).join('\n')
      : cleanCode;
  return `${CONFIG_PREFIX}${JSON.stringify(config)}${CONFIG_SUFFIX}\n${bodyCode}`;
}

/**
 * 현재 피지컬 컴퓨팅 회로 구성(보드 + 부품 배열)으로부터
 * 교안에 바로 삽입할 수 있는 「준비물 및 핀 연결표(tableRows)」 2차원 배열을 생성합니다.
 */
export function generateWiringTableRows(
  config: PhysicalCircuitConfig
): string[][] {
  const boardInfo = BOARD_META[config.board];
  const header = [
    '순번',
    '부품 / 모듈명',
    '입출력 구분',
    `${boardInfo.shortLabel} 연결 핀`,
    '전원 배선 (VCC / GND)',
    '회로 배선 및 코딩 유의사항',
  ];

  const rows: string[][] = [header];

  if (!config.components || config.components.length === 0) {
    rows.push([
      '1',
      `${boardInfo.shortLabel} 기본 보드`,
      '제어 보드',
      'USB 데이터 케이블 연결',
      'USB 5V 전원 공급',
      '보드의 기본 내장 LED 및 시리얼 출력을 확인합니다.',
    ]);
    return rows;
  }

  config.components.forEach((comp, idx) => {
    const meta = COMPONENT_CATALOG.find((c) => c.type === comp.type);
    const pinLabel = comp.extraPin
      ? `${comp.pin} (보조: ${comp.extraPin})`
      : comp.pin;
    rows.push([
      String(idx + 1),
      `${meta?.icon || '🔌'} ${comp.label}`,
      meta?.ioType || '입출력 부품',
      `**${pinLabel}**`,
      meta?.powerGuide || 'VCC → 전원 핀, GND → GND',
      meta?.wiringNote || '극성(+/-)과 핀 번호를 코드와 일치시키세요.',
    ]);
  });

  return rows;
}

// 5x5 LED 매트릭스 아이콘 패턴 사전 (BBC micro:bit 용)
const MICROBIT_ICONS: Record<string, number[][]> = {
  HEART: [
    [0, 1, 0, 1, 0],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [0, 1, 1, 1, 0],
    [0, 0, 1, 0, 0],
  ],
  SMALL_HEART: [
    [0, 0, 0, 0, 0],
    [0, 1, 0, 1, 0],
    [0, 1, 1, 1, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  HAPPY: [
    [0, 0, 0, 0, 0],
    [0, 1, 0, 1, 0],
    [0, 0, 0, 0, 0],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  SAD: [
    [0, 0, 0, 0, 0],
    [0, 1, 0, 1, 0],
    [0, 0, 0, 0, 0],
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
  ],
  YES: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1],
    [0, 0, 0, 1, 0],
    [1, 0, 1, 0, 0],
    [0, 1, 0, 0, 0],
  ],
  NO: [
    [1, 0, 0, 0, 1],
    [0, 1, 0, 1, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 0, 1, 0],
    [1, 0, 0, 0, 1],
  ],
  OFF: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
};

const WIRE_COLORS = [
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#06b6d4', // cyan
];

interface PhysicalComputingBlockProps {
  rawContent: string;
  caption?: string;
  externalUrl?: string;
  onChangeContent?: (newRawContent: string) => void;
  compact?: boolean;
}

export default function PhysicalComputingBlock({
  rawContent,
  caption,
  externalUrl,
  onChangeContent,
  compact = false,
}: PhysicalComputingBlockProps) {
  const parsed = parsePhysicalBlockContent(rawContent);
  const [config, setConfig] = useState<PhysicalCircuitConfig>(parsed.config);
  const [code, setCode] = useState<string>(parsed.code);

  // 외부에서 rawContent가 바뀌면 동기화
  useEffect(() => {
    const next = parsePhysicalBlockContent(rawContent);
    setConfig(next.config);
    setCode(next.code);
  }, [rawContent]);

  // 시뮬레이션 실행 상태
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [tickCount, setTickCount] = useState<number>(0);

  // 가상 센서 입력 상태 (학생/교사가 슬라이더·버튼으로 실시간 조작)
  const [buttonAPressed, setButtonAPressed] = useState<boolean>(false);
  const [buttonBPressed, setButtonBPressed] = useState<boolean>(false);
  const [shakeActive, setShakeActive] = useState<boolean>(false);
  const [extButtonPressed, setExtButtonPressed] = useState<boolean>(false);
  const [distanceCm, setDistanceCm] = useState<number>(35);
  const [lightLevel, setLightLevel] = useState<number>(160);
  const [temperatureC, setTemperatureC] = useState<number>(24);
  const [potValue, setPotValue] = useState<number>(512); // 0 ~ 1023

  // 가상 액추에이터 출력 상태 (시뮬레이션 엔진이 매 틱마다 갱신)
  const [pinStates, setPinStates] = useState<Record<string, number>>({});
  const [microbitIcon, setMicrobitIcon] = useState<string>('HEART');
  const [microbitText, setMicrobitText] = useState<string>('');
  const [servoAngle, setServoAngle] = useState<number>(0);
  const [buzzerFreq, setBuzzerFreq] = useState<number>(0);
  const [serialLogs, setSerialLogs] = useState<string[]>([
    '⚡ 피지컬 컴퓨팅 가상 시뮬레이터 준비 완료 (실시간 센서 연동 중)',
  ]);

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Web Audio API 비프음 재생
  const playTone = useCallback(
    (freq: number, durationMs = 120) => {
      if (!audioEnabled || freq <= 0 || typeof window === 'undefined') return;
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioContextClass) return;
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContextClass();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + durationMs / 1000
        );
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + durationMs / 1000);
      } catch {
        // 브라우저 오디오 자동재생 정책 차단 시 무시
      }
    },
    [audioEnabled]
  );

  // 코드 및 센서 상태 기반 실시간 시뮬레이션 평가 루프
  useEffect(() => {
    if (!isRunning) {
      setBuzzerFreq(0);
      return;
    }

    const timer = setInterval(() => {
      setTickCount((prev) => prev + 1);
    }, 450);

    return () => clearInterval(timer);
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning) return;

    const nextPins: Record<string, number> = {};
    let nextIcon = 'SMALL_HEART';
    let nextScrollText = '';
    let nextServo = servoAngle;
    let nextFreq = 0;
    let newLogLine = '';

    const normalizedCode = code.replace(/\r\n/g, '\n');
    const u16Pot = Math.round((potValue / 1023) * 65535);
    const pwmFromPot = Math.round((potValue / 1023) * 255);
    const angleFromPot = Math.round((potValue / 1023) * 180);

    // 1) 가변저항 map() / duty_u16() 비례 제어 패턴 감지
    if (
      normalizedCode.includes('analogRead(A0)') &&
      normalizedCode.includes('map(')
    ) {
      nextPins['A0'] = potValue;
      nextPins['D9'] = pwmFromPot;
      nextServo = angleFromPot;
      newLogLine = `[Serial 9600] A0=${potValue} -> PWM=${pwmFromPot}, Servo=${angleFromPot}°`;
    }
    if (
      normalizedCode.includes('read_u16()') ||
      normalizedCode.includes('ADC(Pin(26))')
    ) {
      nextPins['GP26'] = u16Pot;
      nextPins['GP15'] = Math.round((potValue / 1023) * 255);
      if (u16Pot > 40000 && normalizedCode.includes('40000')) {
        nextFreq = 784;
        nextPins['GP16'] = 255;
        newLogLine = `[Pico REPL] ADC=${u16Pot} (>40000) -> GP16 부저 784Hz 경보!`;
      } else {
        newLogLine = `[Pico REPL] ADC=${u16Pot} -> GP15 LED 듀티비=${Math.round(
          (potValue / 1023) * 100
        )}%`;
      }
    }

    // 2) 마이크로비트 버튼 A / B / 흔들기 제어
    if (config.board === 'microbit') {
      if (buttonAPressed && normalizedCode.includes('button_a')) {
        nextIcon = 'HEART';
        nextPins['P1'] = 255;
        if (normalizedCode.includes('music.pitch')) nextFreq = 523;
        newLogLine = 'Button A 눌림 -> Image.HEART 표시 & P1 HIGH';
      } else if (buttonBPressed && normalizedCode.includes('button_b')) {
        nextIcon = 'HAPPY';
        nextPins['P1'] = 0;
        if (normalizedCode.includes('music.pitch')) nextFreq = 659;
        newLogLine = 'Button B 눌림 -> Image.HAPPY 표시';
      } else if (shakeActive) {
        nextIcon = 'SURPRISED';
        nextFreq = 880;
        newLogLine = '가속도 센서 Shake 감지!';
      }
    }

    // 3) 조도 센서 조건문 (`light < 100` 등)
    const lightThresholdMatch = normalizedCode.match(/light\s*<\s*(\d+)/);
    if (lightThresholdMatch) {
      const th = parseInt(lightThresholdMatch[1], 10);
      const isDark = lightLevel < th;
      if (config.board === 'microbit') {
        nextPins['P0'] = isDark ? 255 : 0;
        nextIcon = isDark ? 'YES' : 'HAPPY';
        newLogLine = `조도=${lightLevel} (기준 ${th}) -> P0 가로등 ${
          isDark ? 'ON 💡' : 'OFF'
        }, 온도=${temperatureC}°C`;
      } else if (config.board === 'rpi_pico') {
        nextPins['GP15'] = isDark ? 255 : 0;
      } else {
        nextPins['D13'] = isDark ? 255 : 0;
      }
    }

    // 4) 온도 센서 조건문 (`temp >= 28` 또는 `temp >= 30`)
    const tempThresholdMatch = normalizedCode.match(/temp\s*>=\s*(\d+)/);
    if (tempThresholdMatch) {
      const th = parseInt(tempThresholdMatch[1], 10);
      const isHot = temperatureC >= th;
      if (config.board === 'microbit' && isHot) {
        nextIcon = 'SAD';
        nextFreq = 988;
        newLogLine = `⚠️ 고온 감지 (${temperatureC}°C >= ${th}°C) -> Image.SAD 경보!`;
      } else if (config.board === 'rpi_pico') {
        nextServo = isHot ? 90 : 0;
        nextPins['GP17'] = isHot ? 255 : 60;
        newLogLine = `[SmartFarm] 온도=${temperatureC}°C, 밝기=${lightLevel} -> 환기창 ${
          isHot ? '90° 개방' : '0° 닫힘'
        }, 생장LED ${lightLevel < 100 ? 'ON' : 'OFF'}`;
      }
    }

    // 5) 초음파 거리 센서 조건문 (`distance < 20` / `distance < 25` 등)
    const distThresholdMatch = normalizedCode.match(/distance\s*<\s*(\d+)/);
    if (distThresholdMatch) {
      const th1 = parseInt(distThresholdMatch[1], 10);
      if (distanceCm < th1) {
        nextServo = 90;
        if (config.board === 'microbit') {
          nextPins['P0'] = 255;
          nextPins['P1'] = 255;
          nextIcon = 'YES';
          newLogLine = `초음파 거리=${distanceCm}cm (<${th1}cm) -> 차단기 90° 열림 & P0 녹색불 ON`;
        } else if (config.board === 'arduino_uno') {
          nextPins['D13'] = 255;
          nextPins['D11'] = 255;
          nextPins['D8'] = 255;
          nextFreq = 988;
          newLogLine = `[HC-SR04] 거리=${distanceCm}cm (<${th1}cm) -> 경보음 988Hz & 게이트 90° 개방!`;
        } else {
          nextPins['GP15'] = 255;
          newLogLine = `[HC-SR04] 거리=${distanceCm}cm (<${th1}cm) 감지!`;
        }
      } else if (distanceCm < 50 && normalizedCode.includes('distance < 50')) {
        nextServo = 45;
        nextPins['D13'] = 255;
        nextFreq = 523;
        newLogLine = `[HC-SR04] 주의 거리=${distanceCm}cm (<50cm) -> 서보 45° & 주의음`;
      } else {
        nextServo = 0;
        if (config.board === 'microbit') {
          nextPins['P0'] = 0;
          nextIcon = 'NO';
          newLogLine = `초음파 거리=${distanceCm}cm -> 대기 중 (차단기 0° 닫힘)`;
        } else if (config.board === 'arduino_uno') {
          nextPins['D13'] = 0;
          nextPins['D8'] = 0;
          newLogLine = `[HC-SR04] 안전 거리=${distanceCm}cm -> 게이트 0° 닫힘`;
        }
      }
    }

    // 6) 신호등 + 푸시버튼 제어
    const hasTrafficLight = config.components.some(
      (c) => c.type === 'traffic_light'
    );
    if (hasTrafficLight) {
      const tlComp = config.components.find((c) => c.type === 'traffic_light')!;
      const extraPins = (tlComp.extraPin || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const rPin = tlComp.pin;
      const yPin = extraPins[0] || 'D9';
      const gPin = extraPins[1] || 'D10';

      if (extButtonPressed) {
        nextPins[rPin] = 0;
        nextPins[yPin] = 0;
        nextPins[gPin] = 255;
        if (config.board === 'arduino_uno') {
          nextPins['D6'] = 255;
          nextFreq = 880;
        }
        if (config.board === 'rpi_pico') {
          nextPins['GP25'] = 255;
        }
        newLogLine = `보행자 푸시버튼 눌림(HIGH) -> 녹색 신호(${gPin}) 점등!`;
      } else {
        const phase = tickCount % 3;
        nextPins[rPin] = phase === 0 ? 255 : 0;
        nextPins[yPin] = phase === 1 ? 255 : 0;
        nextPins[gPin] = phase === 2 ? 255 : 0;
        const phaseLabel =
          phase === 0
            ? `🔴 적색(${rPin})`
            : phase === 1
            ? `🟡 황색(${yPin})`
            : `🟢 녹색(${gPin})`;
        newLogLine = `신호등 순차 제어 중: ${phaseLabel} 점등`;
      }
    }

    // 7) 일반 디지털 핀 직접 제어 또는 기본 블링크 폴백
    if (Object.keys(nextPins).length === 0) {
      const firstLed = config.components.find((c) => c.type === 'led');
      if (firstLed) {
        const isOn = tickCount % 2 === 0;
        nextPins[firstLed.pin] = isOn ? 255 : 0;
        newLogLine = `${firstLed.pin} (${firstLed.label}) -> ${
          isOn ? 'HIGH (ON)' : 'LOW (OFF)'
        }`;
      }
    }

    // display.scroll("...") 문자열 추출
    const scrollMatch = normalizedCode.match(
      /display\.scroll\(\s*["']([^"']+)["']\s*\)/
    );
    if (scrollMatch) {
      nextScrollText = scrollMatch[1];
    }

    setPinStates(nextPins);
    setMicrobitIcon(nextIcon);
    setMicrobitText(nextScrollText);
    setServoAngle(nextServo);
    setBuzzerFreq(nextFreq);

    if (nextFreq > 0) {
      playTone(nextFreq, 130);
    }

    if (newLogLine) {
      setSerialLogs((prev) => {
        const last = prev[prev.length - 1];
        if (last === newLogLine) return prev;
        return [...prev.slice(-7), newLogLine];
      });
    }
  }, [
    tickCount,
    isRunning,
    code,
    config,
    buttonAPressed,
    buttonBPressed,
    shakeActive,
    extButtonPressed,
    distanceCm,
    lightLevel,
    temperatureC,
    potValue,
    servoAngle,
    playTone,
  ]);

  const handleCodeEdit = (nextCode: string) => {
    setCode(nextCode);
    if (onChangeContent) {
      onChangeContent(serializePhysicalBlockContent(config, nextCode));
    }
  };

  // 코드 에디터에서 Enter 자동 들여쓰기 및 Tab 4칸 지원
  const handleStudentCodeKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    const val = el.value;
    const start = el.selectionStart;
    const end = el.selectionEnd;

    if (e.key === 'Tab') {
      e.preventDefault();
      const nextVal = val.slice(0, start) + '    ' + val.slice(end);
      handleCodeEdit(nextVal);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + 4, start + 4);
      });
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const before = val.slice(0, start);
      const after = val.slice(end);
      const currentLine = before.split('\n').pop() || '';
      const leadingMatch = currentLine.match(/^(\s*)/);
      let indent = leadingMatch ? leadingMatch[1] : '';
      const trimmed = currentLine.replace(/(#|\/\/).*$/, '').trimEnd();
      if (
        trimmed.endsWith(':') ||
        trimmed.endsWith('{') ||
        trimmed.endsWith('(')
      ) {
        indent += '    ';
      }
      const nextVal = `${before}\n${indent}${after}`;
      const nextPos = start + 1 + indent.length;
      handleCodeEdit(nextVal);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(nextPos, nextPos);
      });
    }
  };

  const boardMeta = BOARD_META[config.board];
  const activeMatrix =
    MICROBIT_ICONS[microbitIcon] || MICROBIT_ICONS.HEART;

  const hasUltrasonic = config.components.some((c) => c.type === 'ultrasonic');
  const hasLightSensor =
    config.components.some((c) => c.type === 'light_sensor') ||
    code.includes('read_light_level');
  const hasTempSensor =
    config.components.some((c) => c.type === 'temp_sensor') ||
    code.includes('temperature()');
  const hasPotentiometer = config.components.some(
    (c) => c.type === 'potentiometer'
  );
  const hasButton = config.components.some((c) => c.type === 'button');

  const ledColorMap: Record<
    LedColorOption,
    { onBg: string; glow: string; offBg: string; label: string }
  > = {
    red: {
      onBg: 'bg-red-500',
      glow: 'shadow-[0_0_18px_#ef4444]',
      offBg: 'bg-red-950/50',
      label: '적색',
    },
    yellow: {
      onBg: 'bg-amber-400',
      glow: 'shadow-[0_0_18px_#fbbf24]',
      offBg: 'bg-amber-950/50',
      label: '황색',
    },
    green: {
      onBg: 'bg-emerald-400',
      glow: 'shadow-[0_0_18px_#34d399]',
      offBg: 'bg-emerald-950/50',
      label: '녹색',
    },
    blue: {
      onBg: 'bg-sky-400',
      glow: 'shadow-[0_0_18px_#38bdf8]',
      offBg: 'bg-sky-950/50',
      label: '청색',
    },
    white: {
      onBg: 'bg-white',
      glow: 'shadow-[0_0_18px_#ffffff]',
      offBg: 'bg-slate-700',
      label: '백색',
    },
  };

  return (
    <div className="my-3 overflow-hidden rounded-2xl border-2 border-emerald-500/40 bg-slate-950 text-slate-100 shadow-lg">
      {/* 1. 상단 타이틀 & 제어 바 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/95 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-extrabold text-slate-950 shadow-xs">
            <span>⚡</span>
            <span>{boardMeta.badge}</span>
          </span>
          <span className="truncate text-sm font-extrabold text-white">
            {caption || `${boardMeta.label} 가상 회로 실험실`}
          </span>
          <span className="hidden sm:inline-block rounded-md border border-slate-700 bg-slate-800/90 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
            {boardMeta.languageLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setAudioEnabled((prev) => !prev)}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
              audioEnabled
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                : 'border-slate-700 bg-slate-800 text-slate-400'
            }`}
            title="피에조 부저 주파수 사운드 출력 켜기/끄기"
          >
            {audioEnabled ? '🔊 부저 소리 켜짐' : '🔇 음소거'}
          </button>

          <button
            type="button"
            onClick={() => setIsRunning((prev) => !prev)}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-extrabold transition cursor-pointer ${
              isRunning
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
            }`}
          >
            <span>{isRunning ? '⏸ 일시정지' : '▶ 시뮬레이션 시작'}</span>
          </button>

          <a
            href={externalUrl || boardMeta.defaultExternalSimulatorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            {boardMeta.externalSimulatorLabel} ↗
          </a>
        </div>
      </div>

      {/* 실습 미션 안내 배너 */}
      {config.missionPrompt && (
        <div className="border-b border-emerald-500/20 bg-emerald-950/40 px-4 py-2 text-xs text-emerald-200 flex items-start gap-2">
          <span className="shrink-0 font-extrabold text-emerald-400">
            🎯 실습 미션:
          </span>
          <span className="leading-relaxed">{config.missionPrompt}</span>
        </div>
      )}

      {/* 2. 메인 워크벤치: 좌측(가상 회로 기판 + 점퍼선 + 브레드보드 부품 + 센서 조작기) / 우측(코드 에디터 + 시리얼 모니터) */}
      <div
        className={`grid grid-cols-1 ${
          compact ? 'xl:grid-cols-1' : 'lg:grid-cols-12'
        } gap-0`}
      >
        {/* 좌측: 가상 마이크로컨트롤러 & 브레드보드 회로 캔버스 */}
        <div
          className={`${
            compact ? '' : 'lg:col-span-7 border-b lg:border-b-0 lg:border-r'
          } border-slate-800 p-4 space-y-4 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]`}
        >
          {/* 보드 하드웨어 시각화 카드 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-inner">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isRunning
                      ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]'
                      : 'bg-slate-600'
                  }`}
                />
                <span className="text-xs font-extrabold text-slate-200">
                  {boardMeta.label}
                </span>
              </div>
              <span className="text-[11px] text-slate-400">{boardMeta.mcu}</span>
            </div>

            {/* A. BBC micro:bit V2 보드 그래픽 */}
            {config.board === 'microbit' && (
              <div className="mx-auto max-w-md rounded-2xl border-2 border-slate-700 bg-neutral-900 p-4 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black tracking-wider text-amber-400 uppercase">
                    BBC micro:bit V2
                  </span>
                  <button
                    type="button"
                    onMouseDown={() => setShakeActive(true)}
                    onMouseUp={() => setShakeActive(false)}
                    onMouseLeave={() => setShakeActive(false)}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                      shakeActive
                        ? 'bg-amber-400 text-slate-950'
                        : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    📳 흔들기(Shake) 자극
                  </button>
                </div>

                {/* A 버튼 + 5x5 LED 매트릭스 + B 버튼 */}
                <div className="flex items-center justify-between gap-3 py-3">
                  {/* Button A */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onMouseDown={() => setButtonAPressed(true)}
                      onMouseUp={() => setButtonAPressed(false)}
                      onMouseLeave={() => setButtonAPressed(false)}
                      onClick={() => {
                        setButtonAPressed(true);
                        setTimeout(() => setButtonAPressed(false), 500);
                      }}
                      className={`h-11 w-11 rounded-xl border-2 font-black text-sm transition cursor-pointer shadow-md ${
                        buttonAPressed
                          ? 'border-sky-400 bg-sky-500 text-slate-950 scale-95'
                          : 'border-slate-600 bg-slate-800 text-white hover:border-sky-400'
                      }`}
                    >
                      A
                    </button>
                    <span className="text-[10px] font-bold text-slate-400">
                      클릭/유지
                    </span>
                  </div>

                  {/* 5x5 Red LED Matrix */}
                  <div className="rounded-xl border border-slate-800 bg-black/90 p-3 shadow-inner">
                    <div className="grid grid-cols-5 gap-2">
                      {activeMatrix.map((row, rIdx) =>
                        row.map((cell, cIdx) => {
                          const isOn = isRunning && cell > 0;
                          return (
                            <div
                              key={`${rIdx}-${cIdx}`}
                              className={`h-4 w-4 rounded-xs transition-all duration-150 ${
                                isOn
                                  ? 'bg-red-500 shadow-[0_0_10px_#ef4444] scale-105'
                                  : 'bg-red-950/35'
                              }`}
                            />
                          );
                        })
                      )}
                    </div>
                    {microbitText && (
                      <div className="mt-2 text-center font-mono text-[11px] font-bold text-red-400 animate-pulse">
                        SCROLL: &quot;{microbitText}&quot;
                      </div>
                    )}
                  </div>

                  {/* Button B */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onMouseDown={() => setButtonBPressed(true)}
                      onMouseUp={() => setButtonBPressed(false)}
                      onMouseLeave={() => setButtonBPressed(false)}
                      onClick={() => {
                        setButtonBPressed(true);
                        setTimeout(() => setButtonBPressed(false), 500);
                      }}
                      className={`h-11 w-11 rounded-xl border-2 font-black text-sm transition cursor-pointer shadow-md ${
                        buttonBPressed
                          ? 'border-sky-400 bg-sky-500 text-slate-950 scale-95'
                          : 'border-slate-600 bg-slate-800 text-white hover:border-sky-400'
                      }`}
                    >
                      B
                    </button>
                    <span className="text-[10px] font-bold text-slate-400">
                      클릭/유지
                    </span>
                  </div>
                </div>

                {/* 하단 금색 엣지 커넥터 핀 (P0, P1, P2, 3V, GND) */}
                <div className="mt-3 grid grid-cols-5 gap-2 border-t-2 border-amber-500/40 pt-3">
                  {(['P0', 'P1', 'P2', '3V', 'GND'] as const).map((pin) => {
                    const val = pinStates[pin] || 0;
                    const isPower = pin === '3V';
                    const isGnd = pin === 'GND';
                    return (
                      <div
                        key={pin}
                        className={`flex flex-col items-center rounded-lg border py-1.5 ${
                          isPower
                            ? 'border-red-500/50 bg-red-950/30 text-red-300'
                            : isGnd
                            ? 'border-slate-600 bg-slate-800/80 text-slate-300'
                            : val > 0
                            ? 'border-amber-400 bg-amber-500/20 text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.25)]'
                            : 'border-amber-500/40 bg-amber-950/20 text-amber-400/80'
                        }`}
                      >
                        <div className="h-3 w-3 rounded-full border-2 border-amber-400 bg-slate-950 mb-1" />
                        <span className="font-mono text-xs font-black">
                          {pin}
                        </span>
                        <span className="text-[9px] font-semibold">
                          {isPower
                            ? '3.3V'
                            : isGnd
                            ? '0V'
                            : val > 0
                            ? 'HIGH'
                            : 'LOW'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* B. Arduino Uno R3 보드 그래픽 */}
            {config.board === 'arduino_uno' && (
              <div className="mx-auto max-w-lg rounded-2xl border-2 border-teal-500/60 bg-gradient-to-br from-teal-900 via-teal-950 to-slate-900 p-4 shadow-xl">
                {/* 상단 디지털 핀 헤더 (D13 ~ D2) */}
                <div className="mb-3">
                  <div className="text-[10px] font-bold text-teal-300 mb-1 flex justify-between">
                    <span>DIGITAL (PWM ~) HEADER</span>
                    <span>GND · D13 ~ D2</span>
                  </div>
                  <div className="grid grid-cols-7 sm:grid-cols-13 gap-1 rounded-lg bg-slate-950/90 p-1.5 border border-teal-700/60">
                    {[
                      'GND',
                      'D13',
                      'D12',
                      'D11',
                      'D10',
                      'D9',
                      'D8',
                      'D7',
                      'D6',
                      'D5',
                      'D4',
                      'D3',
                      'D2',
                    ].map((pin) => {
                      const val = pinStates[pin] || 0;
                      const isConnected = config.components.some(
                        (c) =>
                          c.pin === pin ||
                          (c.extraPin && c.extraPin.split(',').includes(pin))
                      );
                      return (
                        <div
                          key={pin}
                          className={`flex flex-col items-center rounded py-1 text-[9px] font-mono font-bold transition ${
                            val > 0
                              ? 'bg-emerald-500 text-slate-950 shadow-[0_0_8px_#10b981]'
                              : isConnected
                              ? 'bg-amber-500/25 text-amber-300 border border-amber-400/50'
                              : 'bg-slate-900 text-slate-400'
                          }`}
                        >
                          <span>{pin}</span>
                          <span className="text-[8px]">
                            {pin === 'GND'
                              ? '0V'
                              : val > 0
                              ? val === 255
                                ? 'HIGH'
                                : val
                              : 'LOW'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 중앙 ATmega328P 칩 및 내장 L(D13) / ON LED */}
                <div className="my-3 flex flex-wrap items-center justify-between gap-3 px-2 py-2 rounded-xl bg-teal-950/80 border border-teal-800/70">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-6 rounded bg-slate-300 border border-slate-400 flex items-center justify-center text-[8px] font-black text-slate-800">
                      USB
                    </div>
                    <div>
                      <div className="text-xs font-black tracking-wide text-white">
                        ARDUINO UNO R3
                      </div>
                      <div className="font-mono text-[10px] text-teal-300">
                        ATmega328P · 16MHz
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold">
                      <span
                        className={`h-3 w-3 rounded-full ${
                          (pinStates['D13'] || 0) > 0
                            ? 'bg-amber-400 shadow-[0_0_10px_#fbbf24]'
                            : 'bg-amber-950'
                        }`}
                      />
                      <span className="text-amber-300">L (D13)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold">
                      <span
                        className={`h-3 w-3 rounded-full ${
                          isRunning
                            ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                            : 'bg-emerald-950'
                        }`}
                      />
                      <span className="text-emerald-300">ON</span>
                    </div>
                  </div>
                </div>

                {/* 하단 전원 + 아날로그 핀 헤더 (5V, GND, A0~A5) */}
                <div>
                  <div className="text-[10px] font-bold text-teal-300 mb-1 flex justify-between">
                    <span>POWER (3.3V · 5V · GND)</span>
                    <span>ANALOG IN (A0 ~ A5)</span>
                  </div>
                  <div className="grid grid-cols-9 gap-1 rounded-lg bg-slate-950/90 p-1.5 border border-teal-700/60">
                    {[
                      '3.3V',
                      '5V',
                      'GND',
                      'A0',
                      'A1',
                      'A2',
                      'A3',
                      'A4',
                      'A5',
                    ].map((pin) => {
                      const val = pinStates[pin] || 0;
                      const isConnected = config.components.some(
                        (c) => c.pin === pin
                      );
                      return (
                        <div
                          key={pin}
                          className={`flex flex-col items-center rounded py-1 text-[9px] font-mono font-bold ${
                            pin === '5V' || pin === '3.3V'
                              ? 'bg-red-950/50 text-red-300 border border-red-500/40'
                              : pin === 'GND'
                              ? 'bg-slate-800 text-slate-300'
                              : isConnected
                              ? 'bg-sky-500/25 text-sky-300 border border-sky-400/50'
                              : 'bg-slate-900 text-slate-400'
                          }`}
                        >
                          <span>{pin}</span>
                          <span className="text-[8px]">
                            {pin === '5V' || pin === '3.3V'
                              ? 'VCC'
                              : pin === 'GND'
                              ? '0V'
                              : val > 0
                              ? val
                              : isConnected
                              ? 'ADC'
                              : '-'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* C. Raspberry Pi Pico (RP2040) 보드 그래픽 */}
            {config.board === 'rpi_pico' && (
              <div className="mx-auto max-w-lg rounded-2xl border-2 border-emerald-500/60 bg-gradient-to-r from-emerald-950 via-green-900 to-emerald-950 p-4 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🍓</span>
                    <div>
                      <div className="text-xs font-black text-white">
                        Raspberry Pi Pico (RP2040)
                      </div>
                      <div className="text-[10px] text-emerald-300">
                        Dual ARM Cortex-M0+ · 264KB SRAM · 16-bit ADC
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-slate-950/70 px-2.5 py-1 border border-emerald-600/40">
                    <span
                      className={`h-3 w-3 rounded-full ${
                        (pinStates['GP25'] || 0) > 0 || isRunning
                          ? 'bg-lime-400 shadow-[0_0_10px_#a3e635]'
                          : 'bg-lime-950'
                      }`}
                    />
                    <span className="font-mono text-[10px] font-bold text-lime-300">
                      GP25 LED
                    </span>
                  </div>
                </div>

                {/* 피코 GPIO & ADC 핀 맵 바 */}
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 rounded-xl bg-slate-950/90 p-2 border border-emerald-700/60">
                  {[
                    '3V3',
                    'GND',
                    'GP13',
                    'GP14',
                    'GP15',
                    'GP16',
                    'GP17',
                    'GP25',
                    'GP26',
                    'GP27',
                    'GP28',
                    'VBUS',
                  ].map((pin) => {
                    const val = pinStates[pin] || 0;
                    const isConnected = config.components.some(
                      (c) =>
                        c.pin === pin ||
                        (c.extraPin && c.extraPin.split(',').includes(pin))
                    );
                    return (
                      <div
                        key={pin}
                        className={`flex flex-col items-center rounded py-1 text-[9px] font-mono font-bold ${
                          pin === '3V3' || pin === 'VBUS'
                            ? 'bg-red-950/60 text-red-300 border border-red-500/40'
                            : pin === 'GND'
                            ? 'bg-slate-800 text-slate-300'
                            : val > 0
                            ? 'bg-lime-400 text-slate-950 shadow-[0_0_8px_#a3e635]'
                            : isConnected
                            ? 'bg-amber-500/25 text-amber-300 border border-amber-400/50'
                            : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        <span>{pin}</span>
                        <span className="text-[8px]">
                          {pin === '3V3' || pin === 'VBUS'
                            ? 'VCC'
                            : pin === 'GND'
                            ? '0V'
                            : val > 0
                            ? val > 255
                              ? 'ADC'
                              : 'HIGH'
                            : isConnected
                            ? 'IN/OUT'
                            : 'LOW'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SVG 컬러 점퍼선(Jumper Wires) 배선 연결 시각화 */}
            {config.components.length > 0 && (
              <div className="my-2">
                <svg
                  viewBox="0 0 600 44"
                  className="w-full h-11 overflow-visible"
                >
                  {config.components.map((comp, idx) => {
                    const count = config.components.length;
                    const startX = 120 + (idx * 360) / Math.max(1, count);
                    const endX =
                      ((idx + 0.5) * 600) / Math.max(1, count);
                    const wireColor = WIRE_COLORS[idx % WIRE_COLORS.length];
                    const isActive = (pinStates[comp.pin] || 0) > 0;
                    return (
                      <g key={comp.id}>
                        {/* 신호선 (컬러 점퍼선) */}
                        <path
                          d={`M ${startX} 2 C ${startX} 22, ${endX} 22, ${endX} 42`}
                          fill="none"
                          stroke={wireColor}
                          strokeWidth={isActive ? 3.5 : 2.5}
                          strokeDasharray={isActive ? undefined : 'none'}
                        />
                        {/* GND 선 (검은색 보조 점퍼선) */}
                        <path
                          d={`M ${startX + 10} 2 C ${startX + 10} 22, ${
                            endX + 10
                          } 22, ${endX + 10} 42`}
                          fill="none"
                          stroke="#475569"
                          strokeWidth={1.5}
                          strokeDasharray="3 2"
                        />
                        <circle
                          cx={startX}
                          cy={4}
                          r={3.5}
                          fill={wireColor}
                        />
                        <circle cx={endX} cy={40} r={3.5} fill={wireColor} />
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}

            {/* 가상 브레드보드(Breadboard) 부품 상태 카드 그리드 */}
            <div className="rounded-xl border border-slate-700/80 bg-slate-950/90 p-3">
              <div className="mb-2 flex items-center justify-between text-[11px]">
                <span className="font-extrabold text-slate-300">
                  🔌 브레드보드 연결 부품 & 실시간 작동 상태
                </span>
                <span className="text-slate-400">
                  빨강(VCC) · 검정(GND) · 컬러(신호 핀)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {config.components.map((comp, idx) => {
                  const wireColor = WIRE_COLORS[idx % WIRE_COLORS.length];
                  const sigVal = pinStates[comp.pin] || 0;

                  return (
                    <div
                      key={comp.id}
                      className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-extrabold text-white truncate">
                          {comp.label}
                        </span>
                        <span
                          style={{
                            borderColor: wireColor,
                            color: wireColor,
                          }}
                          className="shrink-0 rounded-md border bg-slate-950 px-2 py-0.5 font-mono text-[10px] font-black"
                        >
                          핀 {comp.pin}
                          {comp.extraPin ? ` · ${comp.extraPin}` : ''}
                        </span>
                      </div>

                      {/* 부품 타입별 인터랙티브 시각 그래픽 */}
                      {comp.type === 'led' && (() => {
                        const cOpt = comp.color || 'red';
                        const styleObj = ledColorMap[cOpt] || ledColorMap.red;
                        const isOn = isRunning && sigVal > 0;
                        return (
                          <div className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`h-7 w-7 rounded-full border-2 border-white/20 transition-all duration-150 ${
                                  isOn
                                    ? `${styleObj.onBg} ${styleObj.glow} scale-110`
                                    : styleObj.offBg
                                }`}
                              />
                              <div className="text-[11px]">
                                <div className="font-bold text-slate-200">
                                  {styleObj.label} LED + 220Ω 저항
                                </div>
                                <div className="font-mono text-[10px] text-slate-400">
                                  {isOn
                                    ? sigVal === 255
                                      ? '상태: HIGH (점등됨)'
                                      : `PWM 밝기: ${sigVal}/255`
                                    : '상태: LOW (소등됨)'}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {comp.type === 'traffic_light' && (() => {
                        const extras = (comp.extraPin || '')
                          .split(',')
                          .map((s) => s.trim());
                        const rPin = comp.pin;
                        const yPin = extras[0] || 'D9';
                        const gPin = extras[1] || 'D10';
                        const rOn = isRunning && (pinStates[rPin] || 0) > 0;
                        const yOn = isRunning && (pinStates[yPin] || 0) > 0;
                        const gOn = isRunning && (pinStates[gPin] || 0) > 0;
                        return (
                          <div className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2">
                            <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-black px-3 py-1.5">
                              <div
                                className={`h-5 w-5 rounded-full transition ${
                                  rOn
                                    ? 'bg-red-500 shadow-[0_0_12px_#ef4444]'
                                    : 'bg-red-950/40'
                                }`}
                                title={`적색 (${rPin})`}
                              />
                              <div
                                className={`h-5 w-5 rounded-full transition ${
                                  yOn
                                    ? 'bg-amber-400 shadow-[0_0_12px_#fbbf24]'
                                    : 'bg-amber-950/40'
                                }`}
                                title={`황색 (${yPin})`}
                              />
                              <div
                                className={`h-5 w-5 rounded-full transition ${
                                  gOn
                                    ? 'bg-emerald-400 shadow-[0_0_12px_#34d399]'
                                    : 'bg-emerald-950/40'
                                }`}
                                title={`녹색 (${gPin})`}
                              />
                            </div>
                            <span className="font-mono text-[10px] text-slate-300">
                              {rOn ? '🔴 정지' : yOn ? '🟡 주의' : gOn ? '🟢 보행' : '대기'}
                            </span>
                          </div>
                        );
                      })()}

                      {comp.type === 'servo' && (
                        <div className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2">
                          <div className="flex items-center gap-3">
                            <div className="relative h-9 w-9 rounded-full border-2 border-sky-500/60 bg-sky-950/50 flex items-center justify-center">
                              <div
                                style={{
                                  transform: `rotate(${servoAngle - 90}deg)`,
                                }}
                                className="h-4 w-1.5 origin-bottom rounded-full bg-amber-400 transition-transform duration-300"
                              />
                            </div>
                            <div className="text-[11px]">
                              <div className="font-bold text-sky-300">
                                SG90 마이크로 서보
                              </div>
                              <div className="font-mono text-[10px] text-amber-300">
                                현재 각도: {servoAngle}°
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {comp.type === 'buzzer' && (
                        <div className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm ${
                                isRunning && buzzerFreq > 0
                                  ? 'border-amber-400 bg-amber-500/20 animate-bounce'
                                  : 'border-slate-700 bg-slate-900'
                              }`}
                            >
                              {isRunning && buzzerFreq > 0 ? '🔊' : '🔈'}
                            </div>
                            <div className="text-[11px]">
                              <div className="font-bold text-slate-200">
                                피에조 부저 출력
                              </div>
                              <div className="font-mono text-[10px] text-amber-300">
                                {isRunning && buzzerFreq > 0
                                  ? `${buzzerFreq} Hz 음 출력 중 ♪`
                                  : '무음 (대기 중)'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {comp.type === 'button' && (
                        <div className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2">
                          <span className="text-[11px] text-slate-300">
                            상태:{' '}
                            <strong
                              className={
                                extButtonPressed
                                  ? 'text-emerald-400'
                                  : 'text-slate-400'
                              }
                            >
                              {extButtonPressed ? 'HIGH (눌림)' : 'LOW (해제)'}
                            </strong>
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setExtButtonPressed((prev) => !prev)
                            }
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition cursor-pointer ${
                              extButtonPressed
                                ? 'bg-emerald-500 text-slate-950'
                                : 'border border-slate-600 bg-slate-800 text-white hover:bg-slate-700'
                            }`}
                          >
                            {extButtonPressed
                              ? '🔘 버튼 떼기'
                              : '🔘 버튼 누르기'}
                          </button>
                        </div>
                      )}

                      {comp.type === 'ultrasonic' && (
                        <div className="rounded-lg bg-slate-950 px-3 py-2 text-[11px] flex items-center justify-between">
                          <span className="text-slate-300">📡 전방 장애물 거리</span>
                          <span className="font-mono font-black text-cyan-300">
                            {distanceCm} cm
                          </span>
                        </div>
                      )}

                      {comp.type === 'potentiometer' && (
                        <div className="rounded-lg bg-slate-950 px-3 py-2 text-[11px] flex items-center justify-between">
                          <span className="text-slate-300">🎛️ 아날로그 다이얼</span>
                          <span className="font-mono font-black text-amber-300">
                            {config.board === 'rpi_pico'
                              ? `${Math.round((potValue / 1023) * 65535)} (16-bit)`
                              : `${potValue} / 1023`}
                          </span>
                        </div>
                      )}

                      {comp.type === 'light_sensor' && (
                        <div className="rounded-lg bg-slate-950 px-3 py-2 text-[11px] flex items-center justify-between">
                          <span className="text-slate-300">☀️ 주변 밝기(조도)</span>
                          <span className="font-mono font-black text-yellow-300">
                            {lightLevel} lx
                          </span>
                        </div>
                      )}

                      {comp.type === 'temp_sensor' && (
                        <div className="rounded-lg bg-slate-950 px-3 py-2 text-[11px] flex items-center justify-between">
                          <span className="text-slate-300">🌡️ 측정 섭씨온도</span>
                          <span className="font-mono font-black text-rose-300">
                            {temperatureC} °C
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 가상 센서 환경 값 조절 패널 (학생이 슬라이더를 움직여 조건문 분기 실험) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-emerald-300">
                🎛️ 가상 센서 입력 컨트롤러 (슬라이더를 움직여 코드의 조건문을 테스트하세요!)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {(hasUltrasonic || code.includes('distance')) && (
                <label className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 block">
                  <div className="flex justify-between font-bold mb-1">
                    <span className="text-slate-300">📡 초음파 거리 (distance)</span>
                    <span className="font-mono text-cyan-400">{distanceCm} cm</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={120}
                    value={distanceCm}
                    onChange={(e) => setDistanceCm(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </label>
              )}

              {(hasLightSensor || code.includes('light')) && (
                <label className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 block">
                  <div className="flex justify-between font-bold mb-1">
                    <span className="text-slate-300">☀️ 주변 빛 밝기 (light)</span>
                    <span className="font-mono text-amber-400">{lightLevel}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={255}
                    value={lightLevel}
                    onChange={(e) => setLightLevel(Number(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </label>
              )}

              {(hasTempSensor || code.includes('temp')) && (
                <label className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 block">
                  <div className="flex justify-between font-bold mb-1">
                    <span className="text-slate-300">🌡️ 주변 온도 (temp)</span>
                    <span className="font-mono text-rose-400">{temperatureC} °C</span>
                  </div>
                  <input
                    type="range"
                    min={-5}
                    max={45}
                    value={temperatureC}
                    onChange={(e) => setTemperatureC(Number(e.target.value))}
                    className="w-full accent-rose-400 cursor-pointer"
                  />
                </label>
              )}

              {(hasPotentiometer ||
                code.includes('analogRead') ||
                code.includes('read_u16')) && (
                <label className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 block">
                  <div className="flex justify-between font-bold mb-1">
                    <span className="text-slate-300">🎛️ 가변저항 (ADC 다이얼)</span>
                    <span className="font-mono text-emerald-400">{potValue}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1023}
                    value={potValue}
                    onChange={(e) => setPotValue(Number(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                </label>
              )}

              {hasButton && (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 flex items-center justify-between">
                  <span className="font-bold text-slate-300">
                    🔘 푸시버튼 입력 신호
                  </span>
                  <button
                    type="button"
                    onClick={() => setExtButtonPressed((prev) => !prev)}
                    className={`rounded-lg px-3 py-1 text-xs font-extrabold transition cursor-pointer ${
                      extButtonPressed
                        ? 'bg-emerald-500 text-slate-950'
                        : 'border border-slate-700 bg-slate-800 text-slate-200'
                    }`}
                  >
                    {extButtonPressed ? '눌림 (HIGH = 1)' : '안 눌림 (LOW = 0)'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 우측: 펌웨어 코드 실습 에디터 + 실시간 시리얼 모니터(Serial Monitor / REPL) */}
        <div
          className={`${
            compact ? '' : 'lg:col-span-5'
          } flex flex-col justify-between bg-slate-950 p-4 space-y-3`}
        >
          <div className="space-y-2 flex-1 flex flex-col">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-emerald-400">
                💻 {boardMeta.languageLabel} 코드 (수정 가능 · Enter 자동 들여쓰기)
              </span>
              <button
                type="button"
                onClick={() => {
                  const orig = parsePhysicalBlockContent(rawContent);
                  setCode(orig.code);
                }}
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                ↺ 초기 코드로 복원
              </button>
            </div>

            <textarea
              value={code}
              spellCheck={false}
              onChange={(e) => handleCodeEdit(e.target.value)}
              onKeyDown={handleStudentCodeKeyDown}
              rows={compact ? 11 : 15}
              className="w-full flex-1 rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 font-mono text-xs leading-relaxed text-emerald-200 focus:border-emerald-500 focus:outline-none resize-y"
            />
          </div>

          {/* 하단 시리얼 모니터 / MicroPython REPL 출력창 */}
          <div className="rounded-xl border border-slate-800 bg-black p-3">
            <div className="mb-1.5 flex items-center justify-between border-b border-slate-800 pb-1 text-[11px]">
              <span className="font-mono font-bold text-amber-400">
                📟{' '}
                {config.board === 'arduino_uno'
                  ? '시리얼 모니터 (Serial Monitor · 9600 baud)'
                  : 'MicroPython REPL 콘솔 출력'}
              </span>
              <button
                type="button"
                onClick={() => setSerialLogs([])}
                className="text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                지우기
              </button>
            </div>
            <div className="h-28 overflow-y-auto space-y-1 font-mono text-[11px] text-slate-300">
              {serialLogs.length === 0 ? (
                <div className="text-slate-600">출력 대기 중...</div>
              ) : (
                serialLogs.map((log, i) => (
                  <div key={i} className="leading-snug">
                    <span className="text-emerald-500 mr-1.5">&gt;</span>
                    <span>{log}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
