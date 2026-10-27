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

export interface JumperWire {
  id: string;
  from: string; // 예: 'MCU:D13', 'MCU:GND', 'BB:a3', 'BB:TOP_+_1', 'BB:TOP_-_2'
  to: string; // 예: 'BB:b3', 'BB:c4', 'BB:TOP_-_4'
  color: string;
  label?: string;
}

export interface VirtualComponent {
  id: string;
  type: VirtualComponentType;
  label: string;
  pin: string;
  extraPin?: string; // 초음파 Echo 핀, 신호등 보조 핀 등
  color?: LedColorOption;
  breadboardCol?: number; // 브레드보드 시작 열 (1~22, 미지정 시 자동 배치)
}

export interface PhysicalCircuitConfig {
  board: PhysicalBoardType;
  components: VirtualComponent[];
  missionPrompt?: string;
  wires?: JumperWire[]; // 사용자/교사가 구성한 브레드보드 점퍼선 배선 목록 (생략 시 자동 표준 배선)
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
      const wires = Array.isArray(parsed.wires) ? parsed.wires : undefined;
      return {
        config: {
          board,
          components,
          missionPrompt: parsed.missionPrompt || '',
          ...(wires !== undefined ? { wires } : {}),
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

// ============================================================================
// 브레드보드(Breadboard) 및 점퍼선(Jumper Wire) 기하/전기 연결 엔진
// ============================================================================

export const BB_COLS = 24; // 1 ~ 24열 하프사이즈 브레드보드 (400 타이포인트)
export const BB_UPPER_ROWS = ['a', 'b', 'c', 'd', 'e'] as const;
export const BB_LOWER_ROWS = ['f', 'g', 'h', 'i', 'j'] as const;
export const BB_RAIL_KEYS = ['TOP_+', 'TOP_-', 'BOT_+', 'BOT_-'] as const;

export const JUMPER_WIRE_PALETTE = [
  { color: '#ef4444', label: '빨강 (VCC 전원)', short: '빨강' },
  { color: '#334155', label: '검정 (GND 접지)', short: '검정' },
  { color: '#f59e0b', label: '노랑 (신호선)', short: '노랑' },
  { color: '#10b981', label: '초록 (신호선)', short: '초록' },
  { color: '#3b82f6', label: '파랑 (신호선)', short: '파랑' },
  { color: '#f97316', label: '주황 (PWM/서보)', short: '주황' },
  { color: '#a855f7', label: '보라 (보조신호)', short: '보라' },
  { color: '#06b6d4', label: '청록 (Echo/데이터)', short: '청록' },
] as const;

const WIRE_COLORS = [
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f97316', // orange
  '#a855f7', // purple
  '#06b6d4', // cyan
];

export interface McuPinSocket {
  holeId: string; // 예: 'MCU:D13', 'MCU:GND', 'MCU:5V'
  pin: string; // 예: 'D13', 'GND', '5V'
  label: string;
  x: number;
  y: number;
  kind: 'gpio' | 'vcc' | 'gnd';
}

export function getBoardDefaultPowerPin(board: PhysicalBoardType): string {
  if (board === 'microbit') return '3V';
  if (board === 'rpi_pico') return '3V3';
  return '5V';
}

export function getBoardMcuSockets(board: PhysicalBoardType): McuPinSocket[] {
  if (board === 'microbit') {
    const pins: { pin: string; kind: 'gpio' | 'vcc' | 'gnd'; x: number }[] = [
      { pin: 'P0', kind: 'gpio', x: 185 },
      { pin: 'P1', kind: 'gpio', x: 250 },
      { pin: 'P2', kind: 'gpio', x: 315 },
      { pin: 'P8', kind: 'gpio', x: 380 },
      { pin: 'P12', kind: 'gpio', x: 440 },
      { pin: 'P16', kind: 'gpio', x: 500 },
      { pin: '3V', kind: 'vcc', x: 565 },
      { pin: 'GND', kind: 'gnd', x: 630 },
    ];
    return pins.map((p) => ({
      holeId: `MCU:${p.pin}`,
      pin: p.pin,
      label: p.pin,
      x: p.x,
      y: 168,
      kind: p.kind,
    }));
  }

  if (board === 'arduino_uno') {
    // 상단 디지털 헤더(y=48) + 하단 전원/아날로그 헤더(y=164)
    const topDigital = [
      'GND2',
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
    ];
    const sockets: McuPinSocket[] = topDigital.map((pin, idx) => ({
      holeId: `MCU:${pin === 'GND2' ? 'GND' : pin}`,
      pin: pin === 'GND2' ? 'GND' : pin,
      label: pin === 'GND2' ? 'GND' : pin,
      x: 156 + idx * 40,
      y: 48,
      kind: pin === 'GND2' ? 'gnd' : 'gpio',
    }));

    const bottomPins: { pin: string; kind: 'gpio' | 'vcc' | 'gnd'; x: number }[] = [
      { pin: '3.3V', kind: 'vcc', x: 170 },
      { pin: '5V', kind: 'vcc', x: 218 },
      { pin: 'GND', kind: 'gnd', x: 266 },
      { pin: 'A0', kind: 'gpio', x: 360 },
      { pin: 'A1', kind: 'gpio', x: 412 },
      { pin: 'A2', kind: 'gpio', x: 464 },
      { pin: 'A3', kind: 'gpio', x: 516 },
      { pin: 'A4', kind: 'gpio', x: 568 },
      { pin: 'A5', kind: 'gpio', x: 620 },
    ];
    bottomPins.forEach((p) => {
      sockets.push({
        holeId: `MCU:${p.pin}`,
        pin: p.pin,
        label: p.pin,
        x: p.x,
        y: 164,
        kind: p.kind,
      });
    });
    return sockets;
  }

  // rpi_pico
  const picoPins: { pin: string; kind: 'gpio' | 'vcc' | 'gnd' }[] = [
    { pin: '3V3', kind: 'vcc' },
    { pin: 'GND', kind: 'gnd' },
    { pin: 'GP0', kind: 'gpio' },
    { pin: 'GP1', kind: 'gpio' },
    { pin: 'GP2', kind: 'gpio' },
    { pin: 'GP13', kind: 'gpio' },
    { pin: 'GP14', kind: 'gpio' },
    { pin: 'GP15', kind: 'gpio' },
    { pin: 'GP16', kind: 'gpio' },
    { pin: 'GP17', kind: 'gpio' },
    { pin: 'GP25', kind: 'gpio' },
    { pin: 'GP26', kind: 'gpio' },
    { pin: 'GP27', kind: 'gpio' },
    { pin: 'GP28', kind: 'gpio' },
  ];
  return picoPins.map((p, idx) => ({
    holeId: `MCU:${p.pin}`,
    pin: p.pin,
    label: p.pin,
    x: 132 + idx * 41,
    y: 162,
    kind: p.kind,
  }));
}

export function getBreadboardColX(col: number): number {
  const clamped = Math.max(1, Math.min(BB_COLS, col));
  return 90 + (clamped - 1) * 26;
}

export function getBreadboardRowY(rowKey: string): number {
  switch (rowKey) {
    case 'TOP_+':
      return 232;
    case 'TOP_-':
      return 250;
    case 'a':
      return 282;
    case 'b':
      return 300;
    case 'c':
      return 318;
    case 'd':
      return 336;
    case 'e':
      return 354;
    case 'f':
      return 436;
    case 'g':
      return 452;
    case 'h':
      return 468;
    case 'i':
      return 484;
    case 'j':
      return 500;
    case 'BOT_+':
      return 522;
    case 'BOT_-':
      return 536;
    default:
      return 318;
  }
}

export function getElectricalNetKeyForHole(holeId: string): string {
  if (holeId.startsWith('MCU:')) {
    const pin = holeId.slice(4);
    if (pin === '3V' || pin === '5V' || pin === '3.3V' || pin === '3V3' || pin === 'VBUS') {
      return 'NET_MCU_VCC';
    }
    if (pin === 'GND' || pin === 'GND2') {
      return 'NET_MCU_GND';
    }
    return `NET_MCU_${pin}`;
  }
  if (holeId.startsWith('BB:')) {
    const raw = holeId.slice(3);
    // 전원 버스 홀: TOP_+_1 ~ TOP_+_24, BOT_-_1 등
    for (const rail of BB_RAIL_KEYS) {
      if (raw.startsWith(`${rail}_`)) {
        return `NET_RAIL_${rail}`;
      }
    }
    // 터미널 스트립 홀: a1 ~ e24 (상단 세로 5칸 연결), f1 ~ j24 (하단 세로 5칸 연결)
    const rowChar = raw.charAt(0);
    const colNum = parseInt(raw.slice(1), 10);
    if (!Number.isNaN(colNum)) {
      if (['a', 'b', 'c', 'd', 'e'].includes(rowChar)) {
        return `NET_STRIP_TOP_${colNum}`;
      }
      if (['f', 'g', 'h', 'i', 'j'].includes(rowChar)) {
        return `NET_STRIP_BOT_${colNum}`;
      }
    }
  }
  return holeId;
}

export function formatHoleDisplayLabel(holeId: string): string {
  if (holeId.startsWith('MCU:')) {
    return `보드 ${holeId.slice(4)} 핀`;
  }
  if (holeId.startsWith('BB:')) {
    const raw = holeId.slice(3);
    if (raw.startsWith('TOP_+_')) return `상단 전원(+) 레일 ${raw.slice(6)}열`;
    if (raw.startsWith('TOP_-_')) return `상단 접지(-) 레일 ${raw.slice(6)}열`;
    if (raw.startsWith('BOT_+_')) return `하단 전원(+) 레일 ${raw.slice(6)}열`;
    if (raw.startsWith('BOT_-_')) return `하단 접지(-) 레일 ${raw.slice(6)}열`;
    const rowChar = raw.charAt(0);
    const colNum = raw.slice(1);
    return `브레드보드 ${colNum}열 ${rowChar}행 (${raw})`;
  }
  return holeId;
}

export function getHoleCoordinates(
  board: PhysicalBoardType,
  holeId: string
): { x: number; y: number } | null {
  if (holeId.startsWith('MCU:')) {
    const targetPin = holeId.slice(4);
    const sockets = getBoardMcuSockets(board);
    // 하단 헤더 우선 매칭 (아두이노 GND 등 브레드보드와 가까운 소켓 선호)
    const matched =
      [...sockets].reverse().find((s) => s.pin === targetPin) ||
      sockets.find((s) => s.holeId === holeId);
    if (matched) return { x: matched.x, y: matched.y };
    return null;
  }
  if (holeId.startsWith('BB:')) {
    const raw = holeId.slice(3);
    for (const rail of BB_RAIL_KEYS) {
      if (raw.startsWith(`${rail}_`)) {
        const col = parseInt(raw.slice(rail.length + 1), 10) || 1;
        return { x: getBreadboardColX(col), y: getBreadboardRowY(rail) };
      }
    }
    const rowChar = raw.charAt(0);
    const col = parseInt(raw.slice(1), 10) || 1;
    return { x: getBreadboardColX(col), y: getBreadboardRowY(rowChar) };
  }
  return null;
}

export interface ComponentLegSpec {
  role: 'sig' | 'sig2' | 'sig3' | 'vcc' | 'gnd';
  label: string;
  col: number;
  holeId: string; // 예: 'BB:e3'
  signalHoleId: string; // 신호 점퍼선 기본 꽃힘 위치 예: 'BB:a3' 또는 'BB:b3'
  powerHoleId: string; // 전원/접지 점퍼선 기본 꽃힘 위치 예: 'BB:c3' 또는 'BB:d3'
  targetPin?: string; // 연결되어야 하는 목표 보드 핀 (예: 'D13', 'P0')
  hasResistor?: boolean;
}

export interface PlacedBreadboardComponent {
  comp: VirtualComponent;
  index: number;
  startCol: number;
  endCol: number;
  isBottomHalf: boolean;
  legs: ComponentLegSpec[];
}

export function getPlacedBreadboardComponents(
  config: PhysicalCircuitConfig
): PlacedBreadboardComponent[] {
  const placed: PlacedBreadboardComponent[] = [];
  let nextTopCol = 3; // 1, 2열은 보드 메인 VCC/GND 전원 공급 점퍼선용으로 확보
  let nextBotCol = 3;

  config.components.forEach((comp, index) => {
    const extras = (comp.extraPin || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    let legDefs: {
      role: 'sig' | 'sig2' | 'sig3' | 'vcc' | 'gnd';
      label: string;
      targetPin?: string;
      hasResistor?: boolean;
    }[] = [];

    switch (comp.type) {
      case 'led':
        legDefs = [
          {
            role: 'sig',
            label: '+(긴다리)',
            targetPin: comp.pin,
            hasResistor: true,
          },
          { role: 'gnd', label: '-(짧은다리)' },
        ];
        break;
      case 'buzzer':
        legDefs = [
          { role: 'sig', label: '+(신호)', targetPin: comp.pin },
          { role: 'gnd', label: '-(GND)' },
        ];
        break;
      case 'button':
        legDefs = [
          { role: 'sig', label: 'SIG', targetPin: comp.pin },
          { role: 'gnd', label: 'GND' },
        ];
        break;
      case 'servo':
        legDefs = [
          { role: 'sig', label: 'PWM', targetPin: comp.pin },
          { role: 'vcc', label: 'VCC' },
          { role: 'gnd', label: 'GND' },
        ];
        break;
      case 'potentiometer':
        legDefs = [
          { role: 'vcc', label: 'VCC' },
          { role: 'sig', label: 'OUT', targetPin: comp.pin },
          { role: 'gnd', label: 'GND' },
        ];
        break;
      case 'light_sensor':
        legDefs = [
          { role: 'vcc', label: 'VCC' },
          { role: 'sig', label: 'OUT', targetPin: comp.pin },
          { role: 'gnd', label: 'GND' },
        ];
        break;
      case 'temp_sensor':
        legDefs = [
          { role: 'vcc', label: 'VCC' },
          { role: 'sig', label: 'VOUT', targetPin: comp.pin },
          { role: 'gnd', label: 'GND' },
        ];
        break;
      case 'ultrasonic':
        legDefs = [
          { role: 'vcc', label: 'VCC' },
          { role: 'sig', label: 'Trig', targetPin: comp.pin },
          {
            role: 'sig2',
            label: 'Echo',
            targetPin:
              extras[0] ||
              (config.board === 'microbit'
                ? 'P8'
                : config.board === 'rpi_pico'
                ? 'GP15'
                : 'D10'),
          },
          { role: 'gnd', label: 'GND' },
        ];
        break;
      case 'traffic_light':
        legDefs = [
          { role: 'sig', label: 'R(적)', targetPin: comp.pin },
          {
            role: 'sig2',
            label: 'Y(황)',
            targetPin:
              extras[0] ||
              (config.board === 'microbit'
                ? 'P1'
                : config.board === 'rpi_pico'
                ? 'GP14'
                : 'D9'),
          },
          {
            role: 'sig3',
            label: 'G(녹)',
            targetPin:
              extras[1] ||
              (config.board === 'microbit'
                ? 'P2'
                : config.board === 'rpi_pico'
                ? 'GP15'
                : 'D10'),
          },
          { role: 'gnd', label: 'GND' },
        ];
        break;
    }

    const span = legDefs.length;
    let isBottomHalf = false;
    let startCol = comp.breadboardCol || nextTopCol;

    if (!comp.breadboardCol) {
      if (nextTopCol + span - 1 <= BB_COLS) {
        startCol = nextTopCol;
        nextTopCol += span + 2; // 부품 간 2열 여유 간격
      } else {
        isBottomHalf = true;
        startCol = Math.min(BB_COLS - span + 1, nextBotCol);
        nextBotCol += span + 2;
      }
    }

    const pinRow = isBottomHalf ? 'f' : 'e';
    const sigRowA = isBottomHalf ? 'j' : 'a';
    const sigRowB = isBottomHalf ? 'i' : 'b';
    const vccRow = isBottomHalf ? 'h' : 'c';
    const gndRow = isBottomHalf ? 'g' : 'd';

    const legs: ComponentLegSpec[] = legDefs.map((ld, lIdx) => {
      const col = startCol + lIdx;
      return {
        role: ld.role,
        label: ld.label,
        col,
        holeId: `BB:${pinRow}${col}`,
        signalHoleId:
          ld.role === 'sig2' ? `BB:${sigRowB}${col}` : `BB:${sigRowA}${col}`,
        powerHoleId:
          ld.role === 'vcc' ? `BB:${vccRow}${col}` : `BB:${gndRow}${col}`,
        targetPin: ld.targetPin,
        hasResistor: ld.hasResistor,
      };
    });

    placed.push({
      comp,
      index,
      startCol,
      endCol: startCol + span - 1,
      isBottomHalf,
      legs,
    });
  });

  return placed;
}

/**
 * 현재 보드와 브레드보드 부품 배치를 기반으로
 * 실제 브레드보드 실습과 동일한 표준 점퍼선(전원선 + 접지선 + 신호선) 배선 세트를 생성합니다.
 */
export function generateDefaultBreadboardWires(
  config: PhysicalCircuitConfig
): JumperWire[] {
  const wires: JumperWire[] = [];
  const placed = getPlacedBreadboardComponents(config);
  const vccPin = getBoardDefaultPowerPin(config.board);

  // 1) 보드 전원(VCC) 및 접지(GND) → 브레드보드 상단 전원 레일(+ / -) 연결
  wires.push({
    id: 'wire-main-vcc',
    from: `MCU:${vccPin}`,
    to: 'BB:TOP_+_1',
    color: '#ef4444',
    label: `보드 ${vccPin} → 브레드보드 (+) 전원 레일`,
  });
  wires.push({
    id: 'wire-main-gnd',
    from: 'MCU:GND',
    to: 'BB:TOP_-_2',
    color: '#334155',
    label: '보드 GND → 브레드보드 (-) 접지 레일',
  });

  // 하단 스트립에 부품이 배치된 경우 상단↔하단 전원 레일 점퍼 브릿지 추가
  if (placed.some((p) => p.isBottomHalf)) {
    wires.push({
      id: 'wire-rail-vcc-bridge',
      from: 'BB:TOP_+_24',
      to: 'BB:BOT_+_24',
      color: '#ef4444',
      label: '상단 (+) 레일 ↔ 하단 (+) 레일 연결',
    });
    wires.push({
      id: 'wire-rail-gnd-bridge',
      from: 'BB:TOP_-_23',
      to: 'BB:BOT_-_23',
      color: '#334155',
      label: '상단 (-) 레일 ↔ 하단 (-) 레일 연결',
    });
  }

  // 2) 각 부품 다리(열 스트립)별 전원·접지·신호 점퍼선 연결
  placed.forEach((p, cIdx) => {
    const baseColor = WIRE_COLORS[cIdx % WIRE_COLORS.length];
    const plusRailPrefix = p.isBottomHalf ? 'BOT_+' : 'TOP_+';
    const minusRailPrefix = p.isBottomHalf ? 'BOT_-' : 'TOP_-';

    p.legs.forEach((leg, lIdx) => {
      if (leg.role === 'vcc') {
        wires.push({
          id: `wire-${p.comp.id}-vcc-${lIdx}`,
          from: `BB:${plusRailPrefix}_${leg.col}`,
          to: leg.powerHoleId,
          color: '#ef4444',
          label: `${p.comp.label} VCC (${leg.col}열) → (+) 전원 레일`,
        });
      } else if (leg.role === 'gnd') {
        wires.push({
          id: `wire-${p.comp.id}-gnd-${lIdx}`,
          from: `BB:${minusRailPrefix}_${leg.col}`,
          to: leg.powerHoleId,
          color: '#475569',
          label: `${p.comp.label} GND (${leg.col}열) → (-) 접지 레일`,
        });
      } else if (leg.targetPin) {
        const sigColor =
          leg.role === 'sig2'
            ? '#eab308'
            : leg.role === 'sig3'
            ? '#10b981'
            : p.comp.type === 'traffic_light' && leg.role === 'sig'
            ? '#ef4444'
            : baseColor;
        wires.push({
          id: `wire-${p.comp.id}-${leg.role}-${lIdx}`,
          from: `MCU:${leg.targetPin}`,
          to: leg.signalHoleId,
          color: sigColor,
          label: `${p.comp.label} ${leg.label} (${leg.col}열) ↔ 보드 ${leg.targetPin}`,
        });
      }
    });
  });

  return wires;
}

export interface ComponentWiringStatus {
  compId: string;
  label: string;
  colRangeText: string;
  isComplete: boolean;
  vccConnected: boolean;
  gndConnected: boolean;
  sigConnectedPin: string | null;
  sig2ConnectedPin: string | null;
  sig3ConnectedPin: string | null;
  guideMessages: string[];
}

export interface BreadboardCircuitAnalysis {
  hasShortCircuit: boolean;
  vccRailPowered: boolean;
  gndRailGrounded: boolean;
  componentStatuses: Record<string, ComponentWiringStatus>;
  allComponentsWired: boolean;
}

/**
 * 브레드보드 내부 금속 클립(세로 5칸 스트립 + 가로 전원 레일)과
 * 사용자가 연결한 점퍼선(JumperWire[])의 전기적 도통(Continuity) 상태를 분석합니다.
 */
export function analyzeBreadboardCircuit(
  config: PhysicalCircuitConfig,
  wires: JumperWire[]
): BreadboardCircuitAnalysis {
  const parent: Record<string, string> = {};
  const find = (x: string): string => {
    if (!parent[x]) parent[x] = x;
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  // 모든 점퍼선의 양 끝단 홀이 속한 전기 노드를 병합
  wires.forEach((w) => {
    const netA = getElectricalNetKeyForHole(w.from);
    const netB = getElectricalNetKeyForHole(w.to);
    union(netA, netB);
  });

  const vccRoot = find('NET_MCU_VCC');
  const gndRoot = find('NET_MCU_GND');
  const hasShortCircuit =
    wires.length > 0 &&
    wires.some(
      (w) =>
        getElectricalNetKeyForHole(w.from) === 'NET_MCU_VCC' ||
        getElectricalNetKeyForHole(w.to) === 'NET_MCU_VCC'
    ) &&
    vccRoot === gndRoot;

  const vccRailPowered =
    find('NET_RAIL_TOP_+') === vccRoot || find('NET_RAIL_BOT_+') === vccRoot;
  const gndRailGrounded =
    find('NET_RAIL_TOP_-') === gndRoot || find('NET_RAIL_BOT_-') === gndRoot;

  const availablePins = BOARD_META[config.board].availablePins;
  const placed = getPlacedBreadboardComponents(config);
  const componentStatuses: Record<string, ComponentWiringStatus> = {};

  placed.forEach((p) => {
    let vccConnected = true;
    let gndConnected = true;
    let sigConnectedPin: string | null = null;
    let sig2ConnectedPin: string | null = null;
    let sig3ConnectedPin: string | null = null;
    const guideMessages: string[] = [];

    p.legs.forEach((leg) => {
      const legNetRoot = find(getElectricalNetKeyForHole(leg.holeId));
      const rowSpanLabel = p.isBottomHalf
        ? `f${leg.col}~j${leg.col}`
        : `a${leg.col}~e${leg.col}`;

      if (leg.role === 'vcc') {
        const ok = legNetRoot === vccRoot;
        if (!ok) {
          vccConnected = false;
          guideMessages.push(
            `${leg.label} 단자(${leg.col}열: ${rowSpanLabel})를 (+) 전원 레일 또는 보드 전원 핀에 연결하세요.`
          );
        }
      } else if (leg.role === 'gnd') {
        const ok = legNetRoot === gndRoot;
        if (!ok) {
          gndConnected = false;
          guideMessages.push(
            `${leg.label} 단자(${leg.col}열: ${rowSpanLabel})를 (-) 접지 레일 또는 보드 GND에 연결하세요.`
          );
        }
      } else {
        // 어떤 보드 GPIO 핀과 연결되어 있는지 탐색
        let matchedPin: string | null = null;
        if (
          leg.targetPin &&
          find(`NET_MCU_${leg.targetPin}`) === legNetRoot
        ) {
          matchedPin = leg.targetPin;
        } else {
          for (const candidatePin of availablePins) {
            if (find(`NET_MCU_${candidatePin}`) === legNetRoot) {
              matchedPin = candidatePin;
              break;
            }
          }
        }

        if (leg.role === 'sig') sigConnectedPin = matchedPin;
        if (leg.role === 'sig2') sig2ConnectedPin = matchedPin;
        if (leg.role === 'sig3') sig3ConnectedPin = matchedPin;

        if (!matchedPin) {
          guideMessages.push(
            `${leg.label} 단자(${leg.col}열: ${rowSpanLabel})를 보드 ${
              leg.targetPin || '신호'
            } 핀에 점퍼선으로 연결하세요.`
          );
        }
      }
    });

    const isComplete =
      !hasShortCircuit &&
      vccConnected &&
      gndConnected &&
      sigConnectedPin !== null &&
      (p.legs.every((l) => l.role !== 'sig2') || sig2ConnectedPin !== null) &&
      (p.legs.every((l) => l.role !== 'sig3') || sig3ConnectedPin !== null);

    componentStatuses[p.comp.id] = {
      compId: p.comp.id,
      label: p.comp.label,
      colRangeText:
        p.startCol === p.endCol
          ? `${p.startCol}열`
          : `${p.startCol}~${p.endCol}열`,
      isComplete,
      vccConnected,
      gndConnected,
      sigConnectedPin,
      sig2ConnectedPin,
      sig3ConnectedPin,
      guideMessages,
    };
  });

  const allComponentsWired =
    !hasShortCircuit &&
    placed.every((p) => componentStatuses[p.comp.id]?.isComplete);

  return {
    hasShortCircuit,
    vccRailPowered,
    gndRailGrounded,
    componentStatuses,
    allComponentsWired,
  };
}

/**
 * 현재 피지컬 컴퓨팅 회로 구성(보드 + 부품 배열 + 브레드보드 열 위치)으로부터
 * 교안에 바로 삽입할 수 있는 「준비물 및 브레드보드 핀 연결표(tableRows)」 2차원 배열을 생성합니다.
 */
export function generateWiringTableRows(
  config: PhysicalCircuitConfig
): string[][] {
  const boardInfo = BOARD_META[config.board];
  const vccPin = getBoardDefaultPowerPin(config.board);
  const header = [
    '순번',
    '부품 / 모듈명',
    '입출력 구분',
    `${boardInfo.shortLabel} 연결 핀`,
    '브레드보드 배선 홀 (열 위치)',
    '회로 배선 및 코딩 유의사항',
  ];

  const rows: string[][] = [header];

  if (!config.components || config.components.length === 0) {
    rows.push([
      '1',
      `${boardInfo.shortLabel} 기본 보드`,
      '제어 보드',
      'USB 데이터 케이블 연결',
      `전원 레일(+) ← ${vccPin}, (-) ← GND`,
      '보드의 기본 내장 LED 및 시리얼 출력을 확인합니다.',
    ]);
    return rows;
  }

  const placed = getPlacedBreadboardComponents(config);

  placed.forEach((p, idx) => {
    const { comp, legs } = p;
    const meta = COMPONENT_CATALOG.find((c) => c.type === comp.type);
    const pinLabel = comp.extraPin
      ? `${comp.pin} (보조: ${comp.extraPin})`
      : comp.pin;
    const legSummary = legs
      .map(
        (l) =>
          `${l.label}: ${l.col}열(${
            l.role === 'vcc'
              ? '(+)레일'
              : l.role === 'gnd'
              ? '(-)레일'
              : l.targetPin || comp.pin
          })`
      )
      .join(', ');
    rows.push([
      String(idx + 1),
      `${meta?.icon || '🔌'} ${comp.label}`,
      meta?.ioType || '입출력 부품',
      `**${pinLabel}**`,
      legSummary,
      meta?.wiringNote || '극성(+/-)과 브레드보드 열 번호를 확인하세요.',
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
  SURPRISED: [
    [0, 1, 0, 1, 0],
    [0, 0, 0, 0, 0],
    [0, 1, 1, 1, 0],
    [0, 1, 0, 1, 0],
    [0, 1, 1, 1, 0],
  ],
  OFF: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
};

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
  const [customWires, setCustomWires] = useState<JumperWire[] | null>(() =>
    Array.isArray(parsed.config.wires) ? parsed.config.wires : null
  );

  // 외부에서 rawContent가 바뀌면 동기화
  useEffect(() => {
    const next = parsePhysicalBlockContent(rawContent);
    setConfig(next.config);
    setCode(next.code);
    setCustomWires(Array.isArray(next.config.wires) ? next.config.wires : null);
  }, [rawContent]);

  // 현재 활성화된 점퍼선 목록 (사용자 커스텀 배선이 없으면 표준 브레드보드 배선 자동 생성)
  const activeWires: JumperWire[] =
    customWires !== null ? customWires : generateDefaultBreadboardWires(config);

  // 브레드보드 부품 배치 및 전기적 도통(Continuity) 분석
  const placedComponents = getPlacedBreadboardComponents(config);
  const circuitAnalysis = analyzeBreadboardCircuit(config, activeWires);

  // 인터랙티브 점퍼선 배선 도구 상태
  const [selectedWireColor, setSelectedWireColor] = useState<string>('#ef4444');
  const [wiringStartHole, setWiringStartHole] = useState<string | null>(null);
  const [hoveredHole, setHoveredHole] = useState<string | null>(null);
  const [hoveredWireId, setHoveredWireId] = useState<string | null>(null);
  const [svgMousePos, setSvgMousePos] = useState<{ x: number; y: number } | null>(
    null
  );
  const svgCanvasRef = useRef<SVGSVGElement | null>(null);

  const commitWires = useCallback(
    (nextWires: JumperWire[] | null) => {
      setCustomWires(nextWires);
      const nextConfig: PhysicalCircuitConfig = {
        ...config,
        wires: nextWires === null ? undefined : nextWires,
      };
      setConfig(nextConfig);
      if (onChangeContent) {
        onChangeContent(serializePhysicalBlockContent(nextConfig, code));
      }
    },
    [config, code, onChangeContent]
  );

  // 홀 종류에 따라 추천 점퍼선 색상 자동 선택 보조
  const pickWireColorForHole = useCallback(
    (holeId: string, fallbackColor: string): string => {
      const net = getElectricalNetKeyForHole(holeId);
      if (net === 'NET_MCU_VCC' || net.includes('RAIL_TOP_+') || net.includes('RAIL_BOT_+')) {
        return '#ef4444';
      }
      if (net === 'NET_MCU_GND' || net.includes('RAIL_TOP_-') || net.includes('RAIL_BOT_-')) {
        return '#334155';
      }
      return fallbackColor;
    },
    []
  );

  const handleHoleSelect = useCallback(
    (holeId: string) => {
      if (!wiringStartHole) {
        setWiringStartHole(holeId);
        const suggested = pickWireColorForHole(holeId, selectedWireColor);
        setSelectedWireColor(suggested);
        return;
      }

      if (wiringStartHole === holeId) {
        setWiringStartHole(null);
        return;
      }

      // 이미 동일한 두 홀 사이에 점퍼선이 있으면 제거 후 새로 연결
      const finalColor = pickWireColorForHole(
        holeId,
        pickWireColorForHole(wiringStartHole, selectedWireColor)
      );
      const filtered = activeWires.filter(
        (w) =>
          !(
            (w.from === wiringStartHole && w.to === holeId) ||
            (w.from === holeId && w.to === wiringStartHole)
          )
      );
      const newWire: JumperWire = {
        id: `wire-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        from: wiringStartHole,
        to: holeId,
        color: finalColor,
        label: `${formatHoleDisplayLabel(wiringStartHole)} ↔ ${formatHoleDisplayLabel(holeId)}`,
      };
      commitWires([...filtered, newWire]);
      setWiringStartHole(null);
    },
    [
      wiringStartHole,
      selectedWireColor,
      activeWires,
      commitWires,
      pickWireColorForHole,
    ]
  );

  const handleRemoveWire = useCallback(
    (wireId: string) => {
      commitWires(activeWires.filter((w) => w.id !== wireId));
      setHoveredWireId(null);
    },
    [activeWires, commitWires]
  );

  const handleSvgMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!wiringStartHole || !svgCanvasRef.current) return;
      const rect = svgCanvasRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = ((e.clientX - rect.left) / rect.width) * 780;
      const y = ((e.clientY - rect.top) / rect.height) * 560;
      setSvgMousePos({ x, y });
    },
    [wiringStartHole]
  );

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
    '⚡ 피지컬 컴퓨팅 가상 브레드보드 시뮬레이터 준비 완료',
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

    // 브레드보드 전원(VCC) - 접지(GND) 단락(쇼트) 감지 시 즉시 차단
    if (circuitAnalysis.hasShortCircuit) {
      setPinStates({});
      setBuzzerFreq(0);
      setSerialLogs((prev) => {
        const msg =
          '🚨 [단락 경고] 브레드보드에서 전원(+)과 접지(GND)가 직접 연결(쇼트)되었습니다! 점퍼선을 점검하세요.';
        if (prev[prev.length - 1] === msg) return prev;
        return [...prev.slice(-7), msg];
      });
      return;
    }

    const nextPins: Record<string, number> = {};
    let nextIcon = 'SMALL_HEART';
    let nextScrollText = '';
    let nextServo = servoAngle;
    let nextFreq = 0;
    let newLogLine = '';

    // 특정 타입의 부품이 브레드보드에서 실제로 배선 완료되었는지 확인하는 헬퍼
    const isComponentTypeWired = (type: VirtualComponentType): boolean => {
      const matching = config.components.filter((c) => c.type === type);
      if (matching.length === 0) return true; // 내장 센서 등 부품이 따로 없는 경우 허용
      return matching.some(
        (c) => circuitAnalysis.componentStatuses[c.id]?.isComplete
      );
    };

    const normalizedCode = code.replace(/\r\n/g, '\n');
    const u16Pot = Math.round((potValue / 1023) * 65535);
    const pwmFromPot = Math.round((potValue / 1023) * 255);
    const angleFromPot = Math.round((potValue / 1023) * 180);

    // 1) 가변저항 map() / duty_u16() 비례 제어 패턴 감지
    if (
      normalizedCode.includes('analogRead(A0)') &&
      normalizedCode.includes('map(')
    ) {
      if (isComponentTypeWired('potentiometer')) {
        nextPins['A0'] = potValue;
        nextPins['D9'] = pwmFromPot;
        if (isComponentTypeWired('servo')) nextServo = angleFromPot;
        newLogLine = `[Serial 9600] A0=${potValue} -> PWM=${pwmFromPot}, Servo=${angleFromPot}°`;
      } else {
        newLogLine =
          '⚠️ [배선 미완성] 가변저항(A0)의 VCC·OUT·GND 점퍼선을 브레드보드에 모두 연결하세요.';
      }
    }
    if (
      normalizedCode.includes('read_u16()') ||
      normalizedCode.includes('ADC(Pin(26))')
    ) {
      if (isComponentTypeWired('potentiometer')) {
        nextPins['GP26'] = u16Pot;
        nextPins['GP15'] = Math.round((potValue / 1023) * 255);
        if (u16Pot > 40000 && normalizedCode.includes('40000')) {
          if (isComponentTypeWired('buzzer')) nextFreq = 784;
          nextPins['GP16'] = 255;
          newLogLine = `[Pico REPL] ADC=${u16Pot} (>40000) -> GP16 부저 784Hz 경보!`;
        } else {
          newLogLine = `[Pico REPL] ADC=${u16Pot} -> GP15 LED 듀티비=${Math.round(
            (potValue / 1023) * 100
          )}%`;
        }
      } else {
        newLogLine =
          '⚠️ [배선 미완성] 가변저항(GP26)의 점퍼선을 브레드보드에 연결하세요.';
      }
    }

    // 2) 마이크로비트 버튼 A / B / 흔들기 제어
    if (config.board === 'microbit') {
      if (buttonAPressed && normalizedCode.includes('button_a')) {
        nextIcon = 'HEART';
        nextPins['P1'] = 255;
        if (normalizedCode.includes('music.pitch') && isComponentTypeWired('buzzer')) {
          nextFreq = 523;
        }
        newLogLine = 'Button A 눌림 -> Image.HEART 표시 & P1 HIGH';
      } else if (buttonBPressed && normalizedCode.includes('button_b')) {
        nextIcon = 'HAPPY';
        nextPins['P1'] = 0;
        if (normalizedCode.includes('music.pitch') && isComponentTypeWired('buzzer')) {
          nextFreq = 659;
        }
        newLogLine = 'Button B 눌림 -> Image.HAPPY 표시';
      } else if (shakeActive) {
        nextIcon = 'SURPRISED';
        if (isComponentTypeWired('buzzer')) nextFreq = 880;
        newLogLine = '가속도 센서 Shake 감지!';
      }
    }

    // 3) 조도 센서 조건문 (`light < 100` 등)
    const lightThresholdMatch = normalizedCode.match(/light\s*<\s*(\d+)/);
    if (lightThresholdMatch && isComponentTypeWired('light_sensor')) {
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
    if (tempThresholdMatch && isComponentTypeWired('temp_sensor')) {
      const th = parseInt(tempThresholdMatch[1], 10);
      const isHot = temperatureC >= th;
      if (config.board === 'microbit' && isHot) {
        nextIcon = 'SAD';
        if (isComponentTypeWired('buzzer')) nextFreq = 988;
        newLogLine = `⚠️ 고온 감지 (${temperatureC}°C >= ${th}°C) -> Image.SAD 경보!`;
      } else if (config.board === 'rpi_pico') {
        if (isComponentTypeWired('servo')) nextServo = isHot ? 90 : 0;
        nextPins['GP17'] = isHot ? 255 : 60;
        newLogLine = `[SmartFarm] 온도=${temperatureC}°C, 밝기=${lightLevel} -> 환기창 ${
          isHot ? '90° 개방' : '0° 닫힘'
        }, 생장LED ${lightLevel < 100 ? 'ON' : 'OFF'}`;
      }
    }

    // 5) 초음파 거리 센서 조건문 (`distance < 20` / `distance < 25` 등)
    const distThresholdMatch = normalizedCode.match(/distance\s*<\s*(\d+)/);
    if (distThresholdMatch) {
      if (!isComponentTypeWired('ultrasonic')) {
        newLogLine =
          '⚠️ [배선 미완성] 초음파 센서(VCC·Trig·Echo·GND) 점퍼선을 브레드보드에 연결하세요.';
      } else {
        const th1 = parseInt(distThresholdMatch[1], 10);
        if (distanceCm < th1) {
          if (isComponentTypeWired('servo')) nextServo = 90;
          if (config.board === 'microbit') {
            nextPins['P0'] = 255;
            nextPins['P1'] = 255;
            nextIcon = 'YES';
            newLogLine = `초음파 거리=${distanceCm}cm (<${th1}cm) -> 차단기 90° 열림 & P0 녹색불 ON`;
          } else if (config.board === 'arduino_uno') {
            nextPins['D13'] = 255;
            nextPins['D11'] = 255;
            nextPins['D8'] = 255;
            if (isComponentTypeWired('buzzer')) nextFreq = 988;
            newLogLine = `[HC-SR04] 거리=${distanceCm}cm (<${th1}cm) -> 경보음 988Hz & 게이트 90° 개방!`;
          } else {
            nextPins['GP15'] = 255;
            newLogLine = `[HC-SR04] 거리=${distanceCm}cm (<${th1}cm) 감지!`;
          }
        } else if (
          distanceCm < 50 &&
          normalizedCode.includes('distance < 50')
        ) {
          if (isComponentTypeWired('servo')) nextServo = 45;
          nextPins['D13'] = 255;
          if (isComponentTypeWired('buzzer')) nextFreq = 523;
          newLogLine = `[HC-SR04] 주의 거리=${distanceCm}cm (<50cm) -> 서보 45° & 주의음`;
        } else {
          if (isComponentTypeWired('servo')) nextServo = 0;
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
    }

    // 6) 신호등 + 푸시버튼 제어
    const hasTrafficLight = config.components.some(
      (c) => c.type === 'traffic_light'
    );
    if (hasTrafficLight) {
      const tlComp = config.components.find((c) => c.type === 'traffic_light')!;
      const tlStatus = circuitAnalysis.componentStatuses[tlComp.id];
      const extraPins = (tlComp.extraPin || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const rPin = tlStatus?.sigConnectedPin || tlComp.pin;
      const yPin = tlStatus?.sig2ConnectedPin || extraPins[0] || 'D9';
      const gPin = tlStatus?.sig3ConnectedPin || extraPins[1] || 'D10';

      if (extButtonPressed && isComponentTypeWired('button')) {
        nextPins[rPin] = 0;
        nextPins[yPin] = 0;
        nextPins[gPin] = 255;
        if (config.board === 'arduino_uno') {
          nextPins['D6'] = 255;
          if (isComponentTypeWired('buzzer')) nextFreq = 880;
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
        const ledStatus = circuitAnalysis.componentStatuses[firstLed.id];
        const targetPin = ledStatus?.sigConnectedPin || firstLed.pin;
        const isOn = tickCount % 2 === 0;
        nextPins[targetPin] = isOn ? 255 : 0;
        newLogLine = ledStatus?.isComplete
          ? `${targetPin} (${firstLed.label}) -> ${
              isOn ? 'HIGH (ON)' : 'LOW (OFF)'
            }`
          : `⚠️ [배선 확인] ${firstLed.label}의 점퍼선(신호·GND)을 브레드보드에 연결하세요.`;
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
    circuitAnalysis,
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
          {/* 보드 + 무납땜 브레드보드(빵판) + 점퍼선 직접 배선 캔버스 카드 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/95 p-3.5 shadow-inner space-y-3">
            {/* 상단 보드 정보 & 브레드보드 배선 상태 요약 바 */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isRunning
                      ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]'
                      : 'bg-slate-600'
                  }`}
                />
                <span className="text-xs font-extrabold text-slate-100">
                  {boardMeta.label} + 무납땜 브레드보드 (빵판)
                </span>
                <span className="hidden sm:inline text-[11px] text-slate-400">
                  · {boardMeta.mcu}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {circuitAnalysis.hasShortCircuit ? (
                  <span className="rounded-lg border border-red-500 bg-red-500/20 px-2.5 py-0.5 text-[11px] font-extrabold text-red-200 animate-pulse">
                    🚨 전원(+)·접지(-) 단락(쇼트) 감지!
                  </span>
                ) : circuitAnalysis.allComponentsWired ? (
                  <span className="rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-300">
                    ✅ 모든 브레드보드 점퍼선 도통 완료 ({activeWires.length}개 연결됨)
                  </span>
                ) : (
                  <span className="rounded-lg border border-amber-500/50 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-300">
                    🔌 미연결 부품 있음 · 핀과 브레드보드 홀을 클릭해 점퍼선을 연결하세요
                  </span>
                )}
              </div>
            </div>

            {/* 점퍼선(Jumper Wire) 색상 선택 & 배선 실습 툴바 */}
            <div className="rounded-xl border border-slate-700/80 bg-slate-950/90 p-2.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-extrabold text-emerald-400 mr-1">
                    🧵 점퍼선 색상:
                  </span>
                  {JUMPER_WIRE_PALETTE.map((item) => {
                    const active = selectedWireColor === item.color;
                    return (
                      <button
                        key={item.color}
                        type="button"
                        onClick={() => setSelectedWireColor(item.color)}
                        title={item.label}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold transition cursor-pointer ${
                          active
                            ? 'border-white bg-slate-800 text-white shadow-xs scale-105'
                            : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <span
                          style={{ backgroundColor: item.color }}
                          className="h-2.5 w-2.5 rounded-full border border-white/30"
                        />
                        <span>{item.short}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {wiringStartHole && (
                    <button
                      type="button"
                      onClick={() => setWiringStartHole(null)}
                      className="rounded-lg border border-rose-500/60 bg-rose-500/20 px-2 py-0.5 text-[11px] font-extrabold text-rose-200 hover:bg-rose-500/30 cursor-pointer"
                    >
                      ✕ 연결 취소
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (activeWires.length === 0) return;
                      commitWires(activeWires.slice(0, -1));
                    }}
                    disabled={activeWires.length === 0}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                    title="마지막으로 연결한 점퍼선 1개를 뽑습니다"
                  >
                    ↩ 마지막 선 빼기
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWiringStartHole(null);
                      commitWires([]);
                    }}
                    className="rounded-lg border border-amber-500/50 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-300 hover:bg-amber-500/25 cursor-pointer"
                    title="모든 점퍼선을 뽑고 처음부터 직접 브레드보드 배선 실습을 시작합니다"
                  >
                    🧹 점퍼선 모두 뽑기 (직접 배선 실습)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWiringStartHole(null);
                      commitWires(null);
                    }}
                    className="rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
                    title="표준 정답 브레드보드 점퍼선 배선을 자동으로 연결합니다"
                  >
                    🪄 정답 배선 자동 연결
                  </button>
                </div>
              </div>

              {/* 실시간 배선 안내 메시지 & 브레드보드 내부 도통 원리 팁 */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/90 pt-1.5 text-[11px]">
                {wiringStartHole ? (
                  <span className="font-bold text-amber-300">
                    📍 시작점 선택됨:{' '}
                    <strong className="underline">
                      {formatHoleDisplayLabel(wiringStartHole)}
                    </strong>{' '}
                    → 연결할 도착 핀이나 브레드보드 구멍(홀)을 클릭하세요!
                  </span>
                ) : hoveredHole ? (
                  <span className="font-bold text-sky-300">
                    🔍 {formatHoleDisplayLabel(hoveredHole)}{' '}
                    {hoveredHole.startsWith('BB:TOP_') ||
                    hoveredHole.startsWith('BB:BOT_')
                      ? '(가로 전원 버스: 1~24열 전체가 내부 금속선으로 연결됨)'
                      : hoveredHole.startsWith('BB:')
                      ? '(세로 터미널 스트립: 같은 열의 5칸 구멍이 내부 금속 클립으로 서로 연결됨)'
                      : '(클릭하여 점퍼선 시작)'}
                  </span>
                ) : (
                  <span className="text-slate-400">
                    💡 <strong>배선 방법:</strong> 보드 핀 또는 브레드보드 구멍을{' '}
                    <strong className="text-slate-200">클릭 → 다른 구멍 클릭</strong>(또는 드래그)하면 점퍼선이 꽂힙니다. 연결된 선을 클릭하면 뽑힙니다.
                  </span>
                )}

                {config.board === 'microbit' && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onMouseDown={() => setButtonAPressed(true)}
                      onMouseUp={() => setButtonAPressed(false)}
                      onMouseLeave={() => setButtonAPressed(false)}
                      onClick={() => {
                        setButtonAPressed(true);
                        setTimeout(() => setButtonAPressed(false), 500);
                      }}
                      className={`rounded px-2 py-0.5 text-[10px] font-black cursor-pointer ${
                        buttonAPressed
                          ? 'bg-sky-400 text-slate-950'
                          : 'border border-slate-700 bg-slate-800 text-white'
                      }`}
                    >
                      버튼 A
                    </button>
                    <button
                      type="button"
                      onMouseDown={() => setButtonBPressed(true)}
                      onMouseUp={() => setButtonBPressed(false)}
                      onMouseLeave={() => setButtonBPressed(false)}
                      onClick={() => {
                        setButtonBPressed(true);
                        setTimeout(() => setButtonBPressed(false), 500);
                      }}
                      className={`rounded px-2 py-0.5 text-[10px] font-black cursor-pointer ${
                        buttonBPressed
                          ? 'bg-sky-400 text-slate-950'
                          : 'border border-slate-700 bg-slate-800 text-white'
                      }`}
                    >
                      버튼 B
                    </button>
                    <button
                      type="button"
                      onMouseDown={() => setShakeActive(true)}
                      onMouseUp={() => setShakeActive(false)}
                      onMouseLeave={() => setShakeActive(false)}
                      className={`rounded px-2 py-0.5 text-[10px] font-bold cursor-pointer ${
                        shakeActive
                          ? 'bg-amber-400 text-slate-950'
                          : 'border border-slate-700 bg-slate-800 text-slate-300'
                      }`}
                    >
                      📳 흔들기
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 통합 인터랙티브 SVG 캔버스: 상단 MCU 보드 + 하단 하프사이즈 브레드보드 + 장착 부품 + 베지어 점퍼선 */}
            {(() => {
              const mcuSockets = getBoardMcuSockets(config.board);
              const activeHighlightHole = wiringStartHole || hoveredHole;
              const activeNetKey = activeHighlightHole
                ? getElectricalNetKeyForHole(activeHighlightHole)
                : null;

              const renderInteractiveHole = (
                holeId: string,
                cx: number,
                cy: number,
                opts?: {
                  isMcu?: boolean;
                  pinLabel?: string;
                  kind?: 'gpio' | 'vcc' | 'gnd';
                  labelPos?: 'top' | 'bottom';
                  pinHigh?: boolean;
                }
              ) => {
                const isStart = wiringStartHole === holeId;
                const isHover = hoveredHole === holeId;
                const holeNet = getElectricalNetKeyForHole(holeId);
                const isSameStrip =
                  activeNetKey !== null &&
                  holeNet === activeNetKey &&
                  holeId.startsWith('BB:');
                const hasWirePlugged = activeWires.some(
                  (w) => w.from === holeId || w.to === holeId
                );

                return (
                  <g
                    key={holeId}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredHole(holeId)}
                    onMouseLeave={() =>
                      setHoveredHole((prev) => (prev === holeId ? null : prev))
                    }
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleHoleSelect(holeId);
                    }}
                    onMouseUp={(e) => {
                      e.stopPropagation();
                      if (wiringStartHole && wiringStartHole !== holeId) {
                        handleHoleSelect(holeId);
                      }
                    }}
                  >
                    {/* 넓은 투명 클릭 히트박스 */}
                    <circle cx={cx} cy={cy} r={opts?.isMcu ? 12 : 8.5} fill="transparent" />

                    {/* 동일 브레드보드 내부 도통 스트립 하이라이트 링 */}
                    {(isSameStrip || isStart || isHover) && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={opts?.isMcu ? 9.5 : 6.8}
                        fill={
                          isStart
                            ? 'rgba(251, 191, 36, 0.35)'
                            : isHover
                            ? 'rgba(56, 189, 248, 0.35)'
                            : 'rgba(16, 185, 129, 0.22)'
                        }
                        stroke={
                          isStart
                            ? '#fbbf24'
                            : isHover
                            ? '#38bdf8'
                            : '#10b981'
                        }
                        strokeWidth={1.6}
                      />
                    )}

                    {/* MCU 핀 소켓 외형 vs 브레드보드 구멍 외형 */}
                    {opts?.isMcu ? (
                      <>
                        <rect
                          x={cx - 7}
                          y={cy - 7}
                          width={14}
                          height={14}
                          rx={3}
                          fill={
                            opts.kind === 'vcc'
                              ? '#7f1d1d'
                              : opts.kind === 'gnd'
                              ? '#1e293b'
                              : opts.pinHigh
                              ? '#065f46'
                              : '#0f172a'
                          }
                          stroke={
                            isStart
                              ? '#fbbf24'
                              : opts.kind === 'vcc'
                              ? '#ef4444'
                              : opts.kind === 'gnd'
                              ? '#94a3b8'
                              : opts.pinHigh
                              ? '#34d399'
                              : '#eab308'
                          }
                          strokeWidth={isStart || isHover ? 2.2 : 1.5}
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={3.2}
                          fill={hasWirePlugged ? '#fbbf24' : '#020617'}
                          stroke="#eab308"
                          strokeWidth={1}
                        />
                        {opts.pinLabel && (
                          <text
                            x={cx}
                            y={opts.labelPos === 'top' ? cy - 11 : cy + 18}
                            textAnchor="middle"
                            fill={
                              opts.kind === 'vcc'
                                ? '#fca5a5'
                                : opts.kind === 'gnd'
                                ? '#cbd5e1'
                                : opts.pinHigh
                                ? '#6ee7b7'
                                : '#fde68a'
                            }
                            fontSize={9.5}
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {opts.pinLabel}
                          </text>
                        )}
                      </>
                    ) : (
                      <>
                        <rect
                          x={cx - 3.6}
                          y={cy - 3.6}
                          width={7.2}
                          height={7.2}
                          rx={1.6}
                          fill={
                            isStart
                              ? '#fbbf24'
                              : isHover
                              ? '#38bdf8'
                              : hasWirePlugged
                              ? '#0f172a'
                              : '#334155'
                          }
                          stroke={
                            isStart || isHover
                              ? '#020617'
                              : isSameStrip
                              ? '#10b981'
                              : '#64748b'
                          }
                          strokeWidth={1}
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={1.7}
                          fill={hasWirePlugged ? '#f8fafc' : '#0f172a'}
                        />
                      </>
                    )}
                  </g>
                );
              };

              return (
                <div className="relative overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-1.5">
                  <svg
                    ref={svgCanvasRef}
                    viewBox="0 0 780 560"
                    onMouseMove={handleSvgMouseMove}
                    onClick={() => {
                      if (wiringStartHole) setWiringStartHole(null);
                    }}
                    className="w-full min-w-[660px] h-auto select-none"
                  >
                    <defs>
                      <filter id="ledGlow" x="-40%" y="-40%" width="180%" height="180%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    {/* ========================================== */}
                    {/* 1. 상단 마이크로컨트롤러(MCU) 기판 그래픽 */}
                    {/* ========================================== */}
                    {config.board === 'microbit' && (
                      <g>
                        {/* micro:bit PCB 본체 */}
                        <rect
                          x={140}
                          y={14}
                          width={530}
                          height={172}
                          rx={18}
                          fill="#171717"
                          stroke="#404040"
                          strokeWidth={2.5}
                        />
                        {/* 상단 장식 코너 */}
                        <path
                          d="M 140 50 L 200 14 L 140 14 Z"
                          fill="#ef4444"
                          opacity={0.85}
                        />
                        <path
                          d="M 670 50 L 610 14 L 670 14 Z"
                          fill="#eab308"
                          opacity={0.85}
                        />
                        <text
                          x={210}
                          y={34}
                          fill="#fbbf24"
                          fontSize={12}
                          fontWeight="bold"
                          fontFamily="sans-serif"
                        >
                          BBC micro:bit V2
                        </text>
                        <text
                          x={600}
                          y={34}
                          textAnchor="end"
                          fill="#94a3b8"
                          fontSize={10}
                          fontFamily="monospace"
                        >
                          3V · GND · Edge Connector
                        </text>

                        {/* 버튼 A (인터랙티브) */}
                        <g
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setButtonAPressed(true);
                            setTimeout(() => setButtonAPressed(false), 500);
                          }}
                        >
                          <rect
                            x={195}
                            y={64}
                            width={36}
                            height={36}
                            rx={8}
                            fill={buttonAPressed ? '#38bdf8' : '#262626'}
                            stroke="#64748b"
                            strokeWidth={2}
                          />
                          <circle
                            cx={213}
                            cy={82}
                            r={10}
                            fill={buttonAPressed ? '#0284c7' : '#0f172a'}
                          />
                          <text
                            x={213}
                            y={86}
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize={11}
                            fontWeight="bold"
                          >
                            A
                          </text>
                        </g>

                        {/* 5x5 LED 매트릭스 */}
                        <rect
                          x={338}
                          y={40}
                          width={134}
                          height={92}
                          rx={10}
                          fill="#09090b"
                          stroke="#27272a"
                          strokeWidth={1.5}
                        />
                        {activeMatrix.map((row, rIdx) =>
                          row.map((cell, cIdx) => {
                            const isOn = isRunning && cell > 0;
                            return (
                              <rect
                                key={`mb-led-${rIdx}-${cIdx}`}
                                x={356 + cIdx * 22}
                                y={49 + rIdx * 16}
                                width={10}
                                height={10}
                                rx={2}
                                fill={isOn ? '#ef4444' : '#450a0a'}
                                filter={isOn ? 'url(#ledGlow)' : undefined}
                              />
                            );
                          })
                        )}

                        {/* 버튼 B (인터랙티브) */}
                        <g
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setButtonBPressed(true);
                            setTimeout(() => setButtonBPressed(false), 500);
                          }}
                        >
                          <rect
                            x={575}
                            y={64}
                            width={36}
                            height={36}
                            rx={8}
                            fill={buttonBPressed ? '#38bdf8' : '#262626'}
                            stroke="#64748b"
                            strokeWidth={2}
                          />
                          <circle
                            cx={593}
                            cy={82}
                            r={10}
                            fill={buttonBPressed ? '#0284c7' : '#0f172a'}
                          />
                          <text
                            x={593}
                            y={86}
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize={11}
                            fontWeight="bold"
                          >
                            B
                          </text>
                        </g>

                        {/* 하단 금색 엣지 커넥터 바 */}
                        <rect
                          x={148}
                          y={142}
                          width={514}
                          height={40}
                          rx={8}
                          fill="#292524"
                          stroke="#f59e0b"
                          strokeWidth={1.5}
                        />
                      </g>
                    )}

                    {config.board === 'arduino_uno' && (
                      <g>
                        {/* Arduino Uno R3 틸(Teal) PCB 본체 */}
                        <rect
                          x={108}
                          y={14}
                          width={564}
                          height={174}
                          rx={16}
                          fill="#0f4c5c"
                          stroke="#14b8a6"
                          strokeWidth={2.5}
                        />
                        {/* 좌측 USB-B 메탈 포트 */}
                        <rect
                          x={88}
                          y={54}
                          width={34}
                          height={46}
                          rx={4}
                          fill="#cbd5e1"
                          stroke="#64748b"
                          strokeWidth={2}
                        />
                        <text
                          x={105}
                          y={80}
                          textAnchor="middle"
                          fill="#1e293b"
                          fontSize={8.5}
                          fontWeight="bold"
                        >
                          USB
                        </text>
                        {/* 좌측 하단 DC 배럴 잭 */}
                        <rect
                          x={94}
                          y={124}
                          width={32}
                          height={36}
                          rx={4}
                          fill="#1e293b"
                          stroke="#475569"
                          strokeWidth={1.5}
                        />
                        {/* 상단 디지털 헤더 블랙 소켓 바 */}
                        <rect
                          x={142}
                          y={36}
                          width={508}
                          height={24}
                          rx={4}
                          fill="#09090b"
                          stroke="#334155"
                        />
                        {/* 중앙 ATmega328P DIP 칩 */}
                        <rect
                          x={330}
                          y={84}
                          width={185}
                          height={40}
                          rx={4}
                          fill="#18181b"
                          stroke="#52525b"
                          strokeWidth={1.5}
                        />
                        <text
                          x={422}
                          y={108}
                          textAnchor="middle"
                          fill="#e2e8f0"
                          fontSize={10}
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          ATmega328P-PU
                        </text>
                        <text
                          x={150}
                          y={95}
                          fill="#ffffff"
                          fontSize={14}
                          fontWeight="bold"
                          fontFamily="sans-serif"
                        >
                          ARDUINO UNO R3
                        </text>
                        <text
                          x={150}
                          y={113}
                          fill="#5eead4"
                          fontSize={9.5}
                          fontFamily="monospace"
                        >
                          DIGITAL (PWM~) &amp; ANALOG IN
                        </text>

                        {/* 내장 L(D13) 및 ON 상태 표시 LED */}
                        <circle
                          cx={565}
                          cy={96}
                          r={5.5}
                          fill={
                            (pinStates['D13'] || 0) > 0 ? '#fbbf24' : '#451a03'
                          }
                          filter={
                            (pinStates['D13'] || 0) > 0
                              ? 'url(#ledGlow)'
                              : undefined
                          }
                        />
                        <text
                          x={576}
                          y={99}
                          fill="#fde68a"
                          fontSize={9.5}
                          fontWeight="bold"
                        >
                          L(D13)
                        </text>
                        <circle
                          cx={565}
                          cy={116}
                          r={5.5}
                          fill={isRunning ? '#34d399' : '#064e3b'}
                          filter={isRunning ? 'url(#ledGlow)' : undefined}
                        />
                        <text
                          x={576}
                          y={119}
                          fill="#6ee7b7"
                          fontSize={9.5}
                          fontWeight="bold"
                        >
                          ON
                        </text>

                        {/* 하단 POWER & ANALOG 헤더 블랙 소켓 바 */}
                        <rect
                          x={154}
                          y={152}
                          width={482}
                          height={24}
                          rx={4}
                          fill="#09090b"
                          stroke="#334155"
                        />
                      </g>
                    )}

                    {config.board === 'rpi_pico' && (
                      <g>
                        {/* Raspberry Pi Pico 그린 PCB 본체 */}
                        <rect
                          x={100}
                          y={20}
                          width={596}
                          height={166}
                          rx={14}
                          fill="#064e3b"
                          stroke="#10b981"
                          strokeWidth={2.5}
                        />
                        {/* 좌측 Micro-USB 포트 */}
                        <rect
                          x={84}
                          y={78}
                          width={28}
                          height={36}
                          rx={4}
                          fill="#cbd5e1"
                          stroke="#64748b"
                          strokeWidth={2}
                        />
                        {/* 중앙 RP2040 듀얼코어 칩 */}
                        <rect
                          x={354}
                          y={48}
                          width={74}
                          height={74}
                          rx={6}
                          fill="#18181b"
                          stroke="#52525b"
                          strokeWidth={1.5}
                        />
                        <text
                          x={391}
                          y={84}
                          textAnchor="middle"
                          fill="#e2e8f0"
                          fontSize={10.5}
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          RP2040
                        </text>
                        <text
                          x={391}
                          y={98}
                          textAnchor="middle"
                          fill="#6ee7b7"
                          fontSize={8.5}
                          fontFamily="monospace"
                        >
                          ARM M0+
                        </text>

                        <text
                          x={140}
                          y={66}
                          fill="#ffffff"
                          fontSize={14}
                          fontWeight="bold"
                        >
                          🍓 Raspberry Pi Pico
                        </text>
                        <text
                          x={140}
                          y={85}
                          fill="#6ee7b7"
                          fontSize={10}
                          fontFamily="monospace"
                        >
                          3V3 · GND · GP0~GP28 (ADC0~ADC2)
                        </text>

                        {/* 내장 GP25 LED */}
                        <circle
                          cx={545}
                          cy={74}
                          r={6}
                          fill={
                            (pinStates['GP25'] || 0) > 0 || isRunning
                              ? '#a3e635'
                              : '#1a2e05'
                          }
                          filter="url(#ledGlow)"
                        />
                        <text
                          x={558}
                          y={78}
                          fill="#bef264"
                          fontSize={10}
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          GP25 LED
                        </text>

                        {/* 하단 핀 헤더 소켓 바 */}
                        <rect
                          x={116}
                          y={150}
                          width={566}
                          height={24}
                          rx={4}
                          fill="#09090b"
                          stroke="#334155"
                        />
                      </g>
                    )}

                    {/* MCU 핀 소켓(헤더 구멍) 렌더링 */}
                    {mcuSockets.map((sock) =>
                      renderInteractiveHole(sock.holeId, sock.x, sock.y, {
                        isMcu: true,
                        pinLabel: sock.label,
                        kind: sock.kind,
                        labelPos: sock.y < 100 ? 'top' : 'bottom',
                        pinHigh: (pinStates[sock.pin] || 0) > 0,
                      })
                    )}

                    {/* ========================================== */}
                    {/* 2. 하단 무납땜 브레드보드 (400홀, 1~24열) */}
                    {/* ========================================== */}
                    <g>
                      {/* 브레드보드 외곽 그림자 및 아이보리 화이트 바디 */}
                      <rect
                        x={36}
                        y={212}
                        width={708}
                        height={338}
                        rx={14}
                        fill="#f8fafc"
                        stroke="#cbd5e1"
                        strokeWidth={3}
                      />

                      {/* 상단 전원 레일 빨간선(+) & 파란선(-) */}
                      <line
                        x1={76}
                        y1={222}
                        x2={702}
                        y2={222}
                        stroke="#ef4444"
                        strokeWidth={2}
                      />
                      <line
                        x1={76}
                        y1={260}
                        x2={702}
                        y2={260}
                        stroke="#2563eb"
                        strokeWidth={2}
                      />
                      <text
                        x={56}
                        y={236}
                        fill="#dc2626"
                        fontSize={13}
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        +
                      </text>
                      <text
                        x={56}
                        y={254}
                        fill="#2563eb"
                        fontSize={14}
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        -
                      </text>
                      <text
                        x={716}
                        y={236}
                        fill="#dc2626"
                        fontSize={13}
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        +
                      </text>
                      <text
                        x={716}
                        y={254}
                        fill="#2563eb"
                        fontSize={14}
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        -
                      </text>

                      {/* 중앙 분리 골(DIP IC Trench: y=366~422) */}
                      <rect
                        x={42}
                        y={366}
                        width={696}
                        height={56}
                        rx={6}
                        fill="#e2e8f0"
                        stroke="#cbd5e1"
                        strokeWidth={1.5}
                      />
                      <text
                        x={390}
                        y={398}
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize={10}
                        fontWeight="bold"
                        letterSpacing={2}
                      >
                        BREADBOARD CENTER CHANNEL (상하 분리 영역)
                      </text>

                      {/* 하단 전원 레일 빨간선(+) & 파란선(-) */}
                      <line
                        x1={76}
                        y1={514}
                        x2={702}
                        y2={514}
                        stroke="#ef4444"
                        strokeWidth={2}
                      />
                      <line
                        x1={76}
                        y1={544}
                        x2={702}
                        y2={544}
                        stroke="#2563eb"
                        strokeWidth={2}
                      />
                      <text
                        x={56}
                        y={526}
                        fill="#dc2626"
                        fontSize={13}
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        +
                      </text>
                      <text
                        x={56}
                        y={540}
                        fill="#2563eb"
                        fontSize={14}
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        -
                      </text>

                      {/* 브레드보드 내부 도통 스트립 하이라이트 바 (호버/선택 시 세로 5칸 또는 가로 레일 표시) */}
                      {activeNetKey && activeNetKey.startsWith('NET_STRIP_TOP_') && (() => {
                        const col = parseInt(
                          activeNetKey.replace('NET_STRIP_TOP_', ''),
                          10
                        );
                        const cx = getBreadboardColX(col);
                        return (
                          <rect
                            x={cx - 8}
                            y={273}
                            width={16}
                            height={90}
                            rx={6}
                            fill="rgba(16, 185, 129, 0.22)"
                            stroke="#10b981"
                            strokeWidth={1.5}
                            strokeDasharray="3 2"
                          />
                        );
                      })()}
                      {activeNetKey && activeNetKey.startsWith('NET_STRIP_BOT_') && (() => {
                        const col = parseInt(
                          activeNetKey.replace('NET_STRIP_BOT_', ''),
                          10
                        );
                        const cx = getBreadboardColX(col);
                        return (
                          <rect
                            x={cx - 8}
                            y={428}
                            width={16}
                            height={80}
                            rx={6}
                            fill="rgba(16, 185, 129, 0.22)"
                            stroke="#10b981"
                            strokeWidth={1.5}
                            strokeDasharray="3 2"
                          />
                        );
                      })()}
                      {activeNetKey && activeNetKey.startsWith('NET_RAIL_') && (() => {
                        const railKey = activeNetKey.replace('NET_RAIL_', '');
                        const ry = getBreadboardRowY(railKey);
                        const isPlus = railKey.endsWith('+');
                        return (
                          <rect
                            x={80}
                            y={ry - 7}
                            width={618}
                            height={14}
                            rx={5}
                            fill={
                              isPlus
                                ? 'rgba(239, 68, 68, 0.2)'
                                : 'rgba(37, 99, 235, 0.2)'
                            }
                            stroke={isPlus ? '#ef4444' : '#2563eb'}
                            strokeWidth={1.5}
                            strokeDasharray="4 2"
                          />
                        );
                      })()}

                      {/* 행 알파벳 라벨 (a~e, f~j) */}
                      {BB_UPPER_ROWS.map((r) => (
                        <g key={`lbl-${r}`}>
                          <text
                            x={64}
                            y={getBreadboardRowY(r) + 3.5}
                            textAnchor="middle"
                            fill="#475569"
                            fontSize={10}
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {r}
                          </text>
                          <text
                            x={716}
                            y={getBreadboardRowY(r) + 3.5}
                            textAnchor="middle"
                            fill="#475569"
                            fontSize={10}
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {r}
                          </text>
                        </g>
                      ))}
                      {BB_LOWER_ROWS.map((r) => (
                        <g key={`lbl-${r}`}>
                          <text
                            x={64}
                            y={getBreadboardRowY(r) + 3.5}
                            textAnchor="middle"
                            fill="#475569"
                            fontSize={10}
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {r}
                          </text>
                          <text
                            x={716}
                            y={getBreadboardRowY(r) + 3.5}
                            textAnchor="middle"
                            fill="#475569"
                            fontSize={10}
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {r}
                          </text>
                        </g>
                      ))}

                      {/* 1~24열 번호 및 모든 브레드보드 구멍(홀) 렌더링 */}
                      {Array.from({ length: BB_COLS }, (_, idx) => {
                        const col = idx + 1;
                        const cx = getBreadboardColX(col);
                        return (
                          <g key={`bb-col-${col}`}>
                            {/* 열 번호 (1 ~ 24) */}
                            <text
                              x={cx}
                              y={271}
                              textAnchor="middle"
                              fill={col % 5 === 0 || col === 1 ? '#0f172a' : '#64748b'}
                              fontSize={8.5}
                              fontWeight={col % 5 === 0 || col === 1 ? 'bold' : 'normal'}
                              fontFamily="monospace"
                            >
                              {col}
                            </text>
                            <text
                              x={cx}
                              y={511}
                              textAnchor="middle"
                              fill={col % 5 === 0 || col === 1 ? '#0f172a' : '#64748b'}
                              fontSize={8.5}
                              fontWeight={col % 5 === 0 || col === 1 ? 'bold' : 'normal'}
                              fontFamily="monospace"
                            >
                              {col}
                            </text>

                            {/* 상단 전원 레일 홀 (TOP_+, TOP_-) */}
                            {renderInteractiveHole(
                              `BB:TOP_+_${col}`,
                              cx,
                              getBreadboardRowY('TOP_+')
                            )}
                            {renderInteractiveHole(
                              `BB:TOP_-_${col}`,
                              cx,
                              getBreadboardRowY('TOP_-')
                            )}

                            {/* 상단 터미널 스트립 홀 (a~e) */}
                            {BB_UPPER_ROWS.map((r) =>
                              renderInteractiveHole(
                                `BB:${r}${col}`,
                                cx,
                                getBreadboardRowY(r)
                              )
                            )}

                            {/* 하단 터미널 스트립 홀 (f~j) */}
                            {BB_LOWER_ROWS.map((r) =>
                              renderInteractiveHole(
                                `BB:${r}${col}`,
                                cx,
                                getBreadboardRowY(r)
                              )
                            )}

                            {/* 하단 전원 레일 홀 (BOT_+, BOT_-) */}
                            {renderInteractiveHole(
                              `BB:BOT_+_${col}`,
                              cx,
                              getBreadboardRowY('BOT_+')
                            )}
                            {renderInteractiveHole(
                              `BB:BOT_-_${col}`,
                              cx,
                              getBreadboardRowY('BOT_-')
                            )}
                          </g>
                        );
                      })}
                    </g>

                    {/* ========================================== */}
                    {/* 3. 브레드보드에 장착된 전자 부품 & 금속 다리 */}
                    {/* ========================================== */}
                    {placedComponents.map((placed) => {
                      const { comp, legs, startCol, endCol, isBottomHalf } = placed;
                      const compStatus = circuitAnalysis.componentStatuses[comp.id];
                      const isWiredOk = Boolean(compStatus?.isComplete);
                      const startX = getBreadboardColX(startCol);
                      const endX = getBreadboardColX(endCol);
                      const centerX = (startX + endX) / 2;
                      const bodyWidth = Math.max(46, endX - startX + 34);
                      const bodyY = isBottomHalf ? 386 : 364;
                      const sigPin = compStatus?.sigConnectedPin || comp.pin;
                      const sigVal = isWiredOk ? pinStates[sigPin] || 0 : 0;

                      const ledFillMap: Record<LedColorOption, string> = {
                        red: '#ef4444',
                        yellow: '#fbbf24',
                        green: '#10b981',
                        blue: '#38bdf8',
                        white: '#f8fafc',
                      };

                      return (
                        <g key={`bb-comp-${comp.id}`}>
                          {/* 각 부품 다리(리드선)가 브레드보드 e열(또는 f열) 구멍에 꽂히는 금속 핀 표현 */}
                          {legs.map((leg) => {
                            const lx = getBreadboardColX(leg.col);
                            const holeY = getBreadboardRowY(
                              isBottomHalf ? 'f' : 'e'
                            );
                            const legStartY = isBottomHalf
                              ? bodyY + 38
                              : bodyY + 4;
                            return (
                              <g key={`${comp.id}-leg-${leg.col}`}>
                                <line
                                  x1={lx}
                                  y1={legStartY}
                                  x2={lx}
                                  y2={holeY}
                                  stroke="#94a3b8"
                                  strokeWidth={3}
                                  strokeLinecap="round"
                                />
                                {/* LED 양극(+) 다리에 직렬 연결된 220Ω 보호 저항 그래픽 */}
                                {leg.hasResistor && (
                                  <g>
                                    <rect
                                      x={lx - 4.5}
                                      y={Math.min(legStartY, holeY) + 2}
                                      width={9}
                                      height={12}
                                      rx={2}
                                      fill="#d97706"
                                      stroke="#78350f"
                                      strokeWidth={1}
                                    />
                                    <line
                                      x1={lx - 4}
                                      y1={Math.min(legStartY, holeY) + 5}
                                      x2={lx + 4}
                                      y2={Math.min(legStartY, holeY) + 5}
                                      stroke="#ef4444"
                                      strokeWidth={1.2}
                                    />
                                    <line
                                      x1={lx - 4}
                                      y1={Math.min(legStartY, holeY) + 8}
                                      x2={lx + 4}
                                      y2={Math.min(legStartY, holeY) + 8}
                                      stroke="#ef4444"
                                      strokeWidth={1.2}
                                    />
                                  </g>
                                )}
                                <circle
                                  cx={lx}
                                  cy={holeY}
                                  r={2.8}
                                  fill="#e2e8f0"
                                  stroke="#334155"
                                  strokeWidth={1}
                                />
                              </g>
                            );
                          })}

                          {/* 부품 본체 패키지 박스 */}
                          <rect
                            x={centerX - bodyWidth / 2}
                            y={bodyY}
                            width={bodyWidth}
                            height={54}
                            rx={9}
                            fill="#0f172a"
                            stroke={isWiredOk ? '#10b981' : '#f59e0b'}
                            strokeWidth={2}
                          />

                          {/* 부품 종류별 핵심 비주얼 아이콘 & 상태 표시 */}
                          {comp.type === 'led' && (() => {
                            const cKey = comp.color || 'red';
                            const activeColor = ledFillMap[cKey] || '#ef4444';
                            const isOn = isRunning && isWiredOk && sigVal > 0;
                            return (
                              <g>
                                <circle
                                  cx={centerX}
                                  cy={bodyY + 20}
                                  r={11}
                                  fill={isOn ? activeColor : '#334155'}
                                  stroke="#ffffff"
                                  strokeWidth={1.5}
                                  filter={isOn ? 'url(#ledGlow)' : undefined}
                                />
                                <text
                                  x={centerX}
                                  y={bodyY + 45}
                                  textAnchor="middle"
                                  fill="#e2e8f0"
                                  fontSize={8.5}
                                  fontWeight="bold"
                                >
                                  {comp.label}
                                </text>
                              </g>
                            );
                          })()}

                          {comp.type === 'traffic_light' && (() => {
                            const rPin = compStatus?.sigConnectedPin || comp.pin;
                            const extras = (comp.extraPin || '')
                              .split(',')
                              .map((s) => s.trim());
                            const yPin =
                              compStatus?.sig2ConnectedPin || extras[0] || 'D9';
                            const gPin =
                              compStatus?.sig3ConnectedPin || extras[1] || 'D10';
                            const rOn =
                              isRunning && isWiredOk && (pinStates[rPin] || 0) > 0;
                            const yOn =
                              isRunning && isWiredOk && (pinStates[yPin] || 0) > 0;
                            const gOn =
                              isRunning && isWiredOk && (pinStates[gPin] || 0) > 0;
                            return (
                              <g>
                                <circle
                                  cx={centerX - 22}
                                  cy={bodyY + 19}
                                  r={7.5}
                                  fill={rOn ? '#ef4444' : '#450a0a'}
                                  filter={rOn ? 'url(#ledGlow)' : undefined}
                                />
                                <circle
                                  cx={centerX}
                                  cy={bodyY + 19}
                                  r={7.5}
                                  fill={yOn ? '#fbbf24' : '#451a03'}
                                  filter={yOn ? 'url(#ledGlow)' : undefined}
                                />
                                <circle
                                  cx={centerX + 22}
                                  cy={bodyY + 19}
                                  r={7.5}
                                  fill={gOn ? '#10b981' : '#064e3b'}
                                  filter={gOn ? 'url(#ledGlow)' : undefined}
                                />
                                <text
                                  x={centerX}
                                  y={bodyY + 45}
                                  textAnchor="middle"
                                  fill="#e2e8f0"
                                  fontSize={8.5}
                                  fontWeight="bold"
                                >
                                  🚦 신호등 모듈 (R·Y·G·GND)
                                </text>
                              </g>
                            );
                          })()}

                          {comp.type === 'ultrasonic' && (
                            <g>
                              <circle
                                cx={centerX - 18}
                                cy={bodyY + 19}
                                r={10}
                                fill="#1e293b"
                                stroke="#38bdf8"
                                strokeWidth={2}
                              />
                              <circle
                                cx={centerX + 18}
                                cy={bodyY + 19}
                                r={10}
                                fill="#1e293b"
                                stroke="#38bdf8"
                                strokeWidth={2}
                              />
                              <text
                                x={centerX}
                                y={bodyY + 45}
                                textAnchor="middle"
                                fill="#67e8f9"
                                fontSize={8.5}
                                fontWeight="bold"
                              >
                                HC-SR04 ({distanceCm}cm)
                              </text>
                            </g>
                          )}

                          {comp.type === 'servo' && (
                            <g>
                              <circle
                                cx={centerX}
                                cy={bodyY + 19}
                                r={10}
                                fill="#0c4a6e"
                                stroke="#38bdf8"
                                strokeWidth={1.5}
                              />
                              <line
                                x1={centerX}
                                y1={bodyY + 19}
                                x2={
                                  centerX +
                                  Math.cos(((servoAngle - 90) * Math.PI) / 180) *
                                    12
                                }
                                y2={
                                  bodyY +
                                  19 +
                                  Math.sin(((servoAngle - 90) * Math.PI) / 180) *
                                    12
                                }
                                stroke="#fbbf24"
                                strokeWidth={3}
                                strokeLinecap="round"
                              />
                              <text
                                x={centerX}
                                y={bodyY + 45}
                                textAnchor="middle"
                                fill="#bae6fd"
                                fontSize={8.5}
                                fontWeight="bold"
                              >
                                SG90 서보 ({isWiredOk ? `${servoAngle}°` : '미연결'})
                              </text>
                            </g>
                          )}

                          {comp.type === 'buzzer' && (
                            <g>
                              <circle
                                cx={centerX}
                                cy={bodyY + 19}
                                r={10}
                                fill="#18181b"
                                stroke={
                                  isRunning && isWiredOk && buzzerFreq > 0
                                    ? '#fbbf24'
                                    : '#64748b'
                                }
                                strokeWidth={2}
                              />
                              <circle
                                cx={centerX}
                                cy={bodyY + 19}
                                r={3.5}
                                fill="#eab308"
                              />
                              <text
                                x={centerX}
                                y={bodyY + 45}
                                textAnchor="middle"
                                fill="#fde68a"
                                fontSize={8.5}
                                fontWeight="bold"
                              >
                                {isRunning && isWiredOk && buzzerFreq > 0
                                  ? `🔊 ${buzzerFreq}Hz`
                                  : '피에조 부저'}
                              </text>
                            </g>
                          )}

                          {(comp.type === 'button' ||
                            comp.type === 'potentiometer' ||
                            comp.type === 'light_sensor' ||
                            comp.type === 'temp_sensor') && (
                            <g
                              className={
                                comp.type === 'button' ? 'cursor-pointer' : undefined
                              }
                              onClick={
                                comp.type === 'button'
                                  ? (e) => {
                                      e.stopPropagation();
                                      setExtButtonPressed((prev) => !prev);
                                    }
                                  : undefined
                              }
                            >
                              <circle
                                cx={centerX}
                                cy={bodyY + 19}
                                r={9.5}
                                fill={
                                  comp.type === 'button' && extButtonPressed
                                    ? '#10b981'
                                    : '#334155'
                                }
                                stroke="#94a3b8"
                                strokeWidth={1.5}
                              />
                              <text
                                x={centerX}
                                y={bodyY + 45}
                                textAnchor="middle"
                                fill="#e2e8f0"
                                fontSize={8.5}
                                fontWeight="bold"
                              >
                                {comp.label}
                              </text>
                            </g>
                          )}

                          {/* 각 다리별 핀 역할 라벨 (SIG / VCC / GND) */}
                          {legs.map((leg) => {
                            const lx = getBreadboardColX(leg.col);
                            return (
                              <text
                                key={`leg-lbl-${comp.id}-${leg.col}`}
                                x={lx}
                                y={bodyY - 3}
                                textAnchor="middle"
                                fill={
                                  leg.role === 'vcc'
                                    ? '#dc2626'
                                    : leg.role === 'gnd'
                                    ? '#334155'
                                    : '#0284c7'
                                }
                                fontSize={7.5}
                                fontWeight="bold"
                                fontFamily="monospace"
                              >
                                {leg.label}
                              </text>
                            );
                          })}
                        </g>
                      );
                    })}

                    {/* ========================================== */}
                    {/* 4. 점퍼선(Jumper Wires) 곡선 렌더링 레이어 */}
                    {/* ========================================== */}
                    {activeWires.map((wire) => {
                      const ptA = getHoleCoordinates(config.board, wire.from);
                      const ptB = getHoleCoordinates(config.board, wire.to);
                      if (!ptA || !ptB) return null;

                      const dx = ptB.x - ptA.x;
                      const dy = ptB.y - ptA.y;
                      const dist = Math.hypot(dx, dy);
                      const arcLift = Math.min(75, Math.max(22, dist * 0.22));
                      const c1x = ptA.x + dx * 0.25;
                      const c1y = Math.min(ptA.y, ptB.y) - arcLift * 0.4 + dy * 0.15;
                      const c2x = ptA.x + dx * 0.75;
                      const c2y = Math.min(ptA.y, ptB.y) - arcLift * 0.4 + dy * 0.85;
                      const pathD = `M ${ptA.x} ${ptA.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ptB.x} ${ptB.y}`;
                      const isWireHovered = hoveredWireId === wire.id;

                      return (
                        <g
                          key={wire.id}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredWireId(wire.id)}
                          onMouseLeave={() =>
                            setHoveredWireId((prev) =>
                              prev === wire.id ? null : prev
                            )
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveWire(wire.id);
                          }}
                        >
                          {/* 클릭 히트 영역 */}
                          <path
                            d={pathD}
                            fill="none"
                            stroke="transparent"
                            strokeWidth={13}
                          />
                          {/* 외곽 그림자 테두리 */}
                          <path
                            d={pathD}
                            fill="none"
                            stroke="#020617"
                            strokeWidth={isWireHovered ? 6.5 : 5}
                            strokeLinecap="round"
                            opacity={0.75}
                          />
                          {/* 실제 컬러 점퍼선 피복 */}
                          <path
                            d={pathD}
                            fill="none"
                            stroke={isWireHovered ? '#f43f5e' : wire.color}
                            strokeWidth={isWireHovered ? 4.5 : 3.2}
                            strokeLinecap="round"
                            strokeDasharray={isWireHovered ? '5 3' : undefined}
                          />
                          {/* 양 끝단 점퍼 핀 부츠(플라스틱 커넥터) */}
                          <circle
                            cx={ptA.x}
                            cy={ptA.y}
                            r={3.5}
                            fill={wire.color}
                            stroke="#020617"
                            strokeWidth={1.2}
                          />
                          <circle
                            cx={ptB.x}
                            cy={ptB.y}
                            r={3.5}
                            fill={wire.color}
                            stroke="#020617"
                            strokeWidth={1.2}
                          />
                        </g>
                      );
                    })}

                    {/* 드래그/클릭 진행 중인 점퍼선 실시간 미리보기 곡선 */}
                    {wiringStartHole && (() => {
                      const startPt = getHoleCoordinates(
                        config.board,
                        wiringStartHole
                      );
                      const endPt =
                        hoveredHole && hoveredHole !== wiringStartHole
                          ? getHoleCoordinates(config.board, hoveredHole)
                          : svgMousePos;
                      if (!startPt || !endPt) return null;
                      const dx = endPt.x - startPt.x;
                      const dy = endPt.y - startPt.y;
                      const pathD = `M ${startPt.x} ${startPt.y} C ${
                        startPt.x + dx * 0.3
                      } ${startPt.y + dy * 0.1 - 25}, ${
                        startPt.x + dx * 0.7
                      } ${startPt.y + dy * 0.9 - 25}, ${endPt.x} ${endPt.y}`;
                      return (
                        <path
                          d={pathD}
                          fill="none"
                          stroke={selectedWireColor}
                          strokeWidth={3.5}
                          strokeDasharray="6 4"
                          strokeLinecap="round"
                          pointerEvents="none"
                        />
                      );
                    })()}
                  </svg>
                </div>
              );
            })()}

            {/* 가상 브레드보드(Breadboard) 부품별 배선 도통 점검 & 실시간 작동 상태 카드 그리드 */}
            <div className="rounded-xl border border-slate-700/80 bg-slate-950/90 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-extrabold text-slate-300">
                  🔌 브레드보드 장착 부품별 배선 점검 &amp; 실시간 상태
                </span>
                <span className="text-slate-400">
                  상단 (+)전원 레일: {circuitAnalysis.vccRailPowered ? '🟢 공급됨' : '⚪ 미연결'} · (-)접지 레일: {circuitAnalysis.gndRailGrounded ? '🟢 접지됨' : '⚪ 미연결'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {config.components.map((comp, idx) => {
                  const wireColor = WIRE_COLORS[idx % WIRE_COLORS.length];
                  const compStatus = circuitAnalysis.componentStatuses[comp.id];
                  const isWiredOk = Boolean(compStatus?.isComplete);
                  const activePin = compStatus?.sigConnectedPin || comp.pin;
                  const sigVal = isWiredOk ? pinStates[activePin] || 0 : 0;

                  return (
                    <div
                      key={comp.id}
                      className={`rounded-xl border p-3 flex flex-col justify-between gap-2 transition ${
                        isWiredOk
                          ? 'border-slate-800 bg-slate-900/90'
                          : 'border-amber-500/40 bg-amber-950/15'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-extrabold text-white truncate">
                            {comp.label}
                          </span>
                          {compStatus && (
                            <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-300">
                              빵판 {compStatus.colRangeText}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ${
                              isWiredOk
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            {isWiredOk ? '✅ 배선됨' : '⚠️ 미연결'}
                          </span>
                          <span
                            style={{
                              borderColor: wireColor,
                              color: wireColor,
                            }}
                            className="rounded-md border bg-slate-950 px-2 py-0.5 font-mono text-[10px] font-black"
                          >
                            {activePin}
                            {comp.extraPin ? ` · ${comp.extraPin}` : ''}
                          </span>
                        </div>
                      </div>

                      {/* 부품 타입별 인터랙티브 시각 그래픽 */}
                      {comp.type === 'led' && (() => {
                        const cOpt = comp.color || 'red';
                        const styleObj = ledColorMap[cOpt] || ledColorMap.red;
                        const isOn = isRunning && isWiredOk && sigVal > 0;
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
                                  {!isWiredOk
                                    ? '점퍼선 배선 필요 (회로 미완성)'
                                    : isOn
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
                        const rPin = compStatus?.sigConnectedPin || comp.pin;
                        const yPin =
                          compStatus?.sig2ConnectedPin || extras[0] || 'D9';
                        const gPin =
                          compStatus?.sig3ConnectedPin || extras[1] || 'D10';
                        const rOn =
                          isRunning && isWiredOk && (pinStates[rPin] || 0) > 0;
                        const yOn =
                          isRunning && isWiredOk && (pinStates[yPin] || 0) > 0;
                        const gOn =
                          isRunning && isWiredOk && (pinStates[gPin] || 0) > 0;
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
                              {!isWiredOk
                                ? '배선 필요'
                                : rOn
                                ? '🔴 정지'
                                : yOn
                                ? '🟡 주의'
                                : gOn
                                ? '🟢 보행'
                                : '대기'}
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
                                  transform: `rotate(${
                                    (isWiredOk ? servoAngle : 0) - 90
                                  }deg)`,
                                }}
                                className="h-4 w-1.5 origin-bottom rounded-full bg-amber-400 transition-transform duration-300"
                              />
                            </div>
                            <div className="text-[11px]">
                              <div className="font-bold text-sky-300">
                                SG90 마이크로 서보
                              </div>
                              <div className="font-mono text-[10px] text-amber-300">
                                {isWiredOk
                                  ? `현재 각도: ${servoAngle}°`
                                  : 'PWM·VCC·GND 점퍼선 연결 필요'}
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
                                isRunning && isWiredOk && buzzerFreq > 0
                                  ? 'border-amber-400 bg-amber-500/20 animate-bounce'
                                  : 'border-slate-700 bg-slate-900'
                              }`}
                            >
                              {isRunning && isWiredOk && buzzerFreq > 0
                                ? '🔊'
                                : '🔈'}
                            </div>
                            <div className="text-[11px]">
                              <div className="font-bold text-slate-200">
                                피에조 부저 출력
                              </div>
                              <div className="font-mono text-[10px] text-amber-300">
                                {!isWiredOk
                                  ? '점퍼선 배선 필요'
                                  : isRunning && buzzerFreq > 0
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
                                extButtonPressed && isWiredOk
                                  ? 'text-emerald-400'
                                  : 'text-slate-400'
                              }
                            >
                              {!isWiredOk
                                ? '미연결'
                                : extButtonPressed
                                ? 'HIGH (눌림)'
                                : 'LOW (해제)'}
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
                            {isWiredOk ? `${distanceCm} cm` : 'Trig·Echo 배선 필요'}
                          </span>
                        </div>
                      )}

                      {comp.type === 'potentiometer' && (
                        <div className="rounded-lg bg-slate-950 px-3 py-2 text-[11px] flex items-center justify-between">
                          <span className="text-slate-300">🎛️ 아날로그 다이얼</span>
                          <span className="font-mono font-black text-amber-300">
                            {!isWiredOk
                              ? 'VCC·OUT·GND 배선 필요'
                              : config.board === 'rpi_pico'
                              ? `${Math.round((potValue / 1023) * 65535)} (16-bit)`
                              : `${potValue} / 1023`}
                          </span>
                        </div>
                      )}

                      {comp.type === 'light_sensor' && (
                        <div className="rounded-lg bg-slate-950 px-3 py-2 text-[11px] flex items-center justify-between">
                          <span className="text-slate-300">☀️ 주변 밝기(조도)</span>
                          <span className="font-mono font-black text-yellow-300">
                            {isWiredOk ? `${lightLevel} lx` : '배선 필요'}
                          </span>
                        </div>
                      )}

                      {comp.type === 'temp_sensor' && (
                        <div className="rounded-lg bg-slate-950 px-3 py-2 text-[11px] flex items-center justify-between">
                          <span className="text-slate-300">🌡️ 측정 섭씨온도</span>
                          <span className="font-mono font-black text-rose-300">
                            {isWiredOk ? `${temperatureC} °C` : '배선 필요'}
                          </span>
                        </div>
                      )}

                      {/* 미연결 단자가 있을 때 친절한 브레드보드 배선 가이드 표시 */}
                      {compStatus && compStatus.guideMessages.length > 0 && (
                        <div className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-2.5 py-1.5 text-[10.5px] text-amber-200 space-y-0.5">
                          {compStatus.guideMessages.map((msg, mIdx) => (
                            <div key={mIdx}>• {msg}</div>
                          ))}
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
