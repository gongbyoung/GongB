import ccxt
import pandas as pd
from datetime import datetime, timedelta

# 업비트 세팅 (API 없어도 조회 가능)
exchange = ccxt.upbit()

symbol = 'XRP/KRW'
timeframe = '1m'  # 1분봉

# ✅ 날짜 설정
start_date = '2024-07-01 09:00:00'
end_date   = '2024-07-01 15:00:00'

# datetime 객체로 변환
start_dt = datetime.strptime(start_date, '%Y-%m-%d %H:%M:%S')
end_dt   = datetime.strptime(end_date, '%Y-%m-%d %H:%M:%S')

# ✅ 데이터 불러오기
def get_ohlcv(symbol, timeframe, start_dt, end_dt):
    all_df = []
    since = int(start_dt.timestamp() * 1000)
    
    while True:
        ohlcv = exchange.fetch_ohlcv(symbol, timeframe, since=since, limit=1000)
        if not ohlcv:
            break
        
        df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        df['datetime'] = pd.to_datetime(df['timestamp'], unit='ms')
        df = df[df['datetime'] <= end_dt]
        
        all_df.append(df)
        if df['datetime'].iloc[-1] >= end_dt:
            break
        since = int(df['timestamp'].iloc[-1]) + 1  # 중복 방지

    return pd.concat(all_df, ignore_index=True)

# ✅ 전략 백테스트
def backtest(df):
    position = None
    entry_price = 0
    trades = []

    for i in range(1, len(df)):
        prev_close = df['close'].iloc[i - 1]
        now_close = df['close'].iloc[i]
        time = df['datetime'].iloc[i]

        change_rate = (now_close - prev_close) / prev_close

        if not position:
            if change_rate >= 0.004:  # 매수 조건
                position = 'long'
                entry_price = now_close
                entry_time = time
        else:
            profit = (now_close - entry_price) / entry_price
            if profit >= 0.008 or profit <= -0.005:
                trades.append({
                    'entry_time': entry_time,
                    'exit_time': time,
                    'entry_price': entry_price,
                    'exit_price': now_close,
                    'profit_rate': round(profit * 100, 2)
                })
                position = None

    return trades

# ✅ 실행
df = get_ohlcv(symbol, timeframe, start_dt, end_dt)
trades = backtest(df)

# ✅ 결과 요약
profits = [t['profit_rate'] for t in trades]
wins = [p for p in profits if p > 0]

print(f"\n📊 백테스트 결과 ({start_date} ~ {end_date})")
print(f"총 매매 횟수: {len(profits)}회")
print(f"승률: {len(wins)}/{len(profits)} ({round(len(wins)/len(profits)*100,2)}%)" if profits else "승률: 0%")
print(f"총 수익률: {round(sum(profits),2)}%")
print("개별 수익률:", profits)
