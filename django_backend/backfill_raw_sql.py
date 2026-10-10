import sqlite3
import hashlib
from decimal import Decimal
from datetime import datetime, timedelta
import json

# Template data
NON_TAGGED_RECEIVES = [
    (Decimal('1.66666667'), Decimal('22.50'), Decimal('13.5'), 5, 0, '8eb7dc3707a465ad'),
    (Decimal('2.72222222'), Decimal('36.75'), Decimal('13.5'), 5, 33724, '52213181883d5c26'),
    (Decimal('3.33333333'), Decimal('45.00'), Decimal('13.5'), 5, 83115, '41d69eb7bb61b105'),
    (Decimal('4.16666667'), Decimal('56.25'), Decimal('13.5'), 6, 29312, 'c1fdc61e20a9b4f0'),
    (Decimal('5.00000000'), Decimal('67.50'), Decimal('13.5'), 6, 60094, 'c74d8a3dfbbfa1a8'),
    (Decimal('2.00000000'), Decimal('27.00'), Decimal('13.5'), 7, 12331, 'f38d74f13690ea44'),
    (Decimal('3.00000000'), Decimal('40.50'), Decimal('13.5'), 7, 57400, '153ae685ecaa6788'),
    (Decimal('3.66666667'), Decimal('49.50'), Decimal('13.5'), 8, 14096, 'a337788d4b6f5540'),
    (Decimal('4.50000000'), Decimal('60.75'), Decimal('13.5'), 8, 47929, '4acbbfcc7207d23d'),
    (Decimal('3.27777778'), Decimal('44.25'), Decimal('13.5'), 8, 82834, '8d0f2c95a708d212'),
]
TAGGED_RECEIVES = [
    (Decimal('11.79555556'), Decimal('159.24'), Decimal('13.5'), '2012-12-10 08:45:26', 'bc1q8fwr538zdgsfzexg93jvcnc0jodlwwvfn2v6eq9u5l5ofpn', 'd4084e624926f60f42e4bcb09584cabc49e4167287d3474bb0b23a97272a5940'),
    (Decimal('15.94666667'), Decimal('215.28'), Decimal('13.5'), '2012-12-10 20:18:51', 'bc12ha6ztf7kwnc4doju7okyuuiaio4n49e3246fr92ps8no5kcios2m7j', '8c40b67d90d2ec4bb25b31792573b33dca6338b7555bf389dd01f844a0d4dd23'),
    (Decimal('0.45555556'), Decimal('6.15'), Decimal('13.5'), '2012-12-12 04:05:52', 'bc1xwm3zwnmd7l54awglsp84igod0fqzw6h33kjue6nfftv4228', '5af190b8f5e68aef7c952551ef857127f48371566855c253c6cecaf98670bc07'),
    (Decimal('9.05407407'), Decimal('122.23'), Decimal('13.5'), '2012-12-16 01:27:17', 'bc1dkfel2l45pgj4pnotjwm7ddyrkc8ma4vus6yxzufg2vi5wy453', '7fb1f126e9a61a69540c5143620dc61cdd0c27b6c7fd755814520971508ca39f'),
    (Decimal('6.05333333'), Decimal('81.72'), Decimal('13.5'), '2012-12-16 05:04:44', 'bc1yi6c2jkmt0czw793cykscpqhiekatxkgzoo6juxl7r4wnm0t4z', '06c460662cc5e80bffb02f8a89b6b866823e962e501d438a5a504792633316ea'),
    (Decimal('16.04074074'), Decimal('216.55'), Decimal('13.5'), '2012-12-16 12:47:09', 'bc1cy9ftn0np3wuhd27946m65lurrgr7aj3osfi2ji5ss2i7f', '2963dd5502da932279eb8d863bc1e20f05741aa1e7ae420b1c68c8c7fc3452fd'),
    (Decimal('18.55333333'), Decimal('250.47'), Decimal('13.5'), '2012-12-20 00:10:51', 'bc1ukylmj6rr3uruu9xc3pzk2n9xuqspnkl7zumgsvpz80zttc2hn72s', 'd4811ecbbef33f26cdb3fc80c9141ccb8fc55324bb4c4f22cc7f7d6af7c9f786'),
    (Decimal('8.31407407'), Decimal('112.24'), Decimal('13.5'), '2012-12-20 01:58:33', 'bc1uo4pnf9ggw9o8dxk0f59a8yj6zlfxfcc2g42kacj2fq9kl77m3v5rk6l6n', 'b999d0a52f71899540f6c9b02b002426005673c97285ab42df20109937e1cdbc'),
    (Decimal('17.04148148'), Decimal('230.06'), Decimal('13.5'), '2012-12-20 15:39:34', 'bc1nhg6n425efsh5247vogh3h8lwu0kvsak0trns4owt7275p0l09dm0', 'eab85bac8f1b46349692042be045819820009b56edc34fff6f3bc5e8c6844e4f'),
    (Decimal('10.21851852'), Decimal('137.95'), Decimal('13.5'), '2012-12-22 19:25:14', 'bc100g26pfxdwqrx73ghuqpgakrgv64sl56r2m7h6nw5', 'e6d401fa4f21a21a0eb11c19d68b0dc120609e2887610420c4800e2c6e480bde'),
    (Decimal('16.20074074'), Decimal('218.71'), Decimal('13.5'), '2012-12-23 06:36:40', 'bc1zz0v62xz504hsyng6ey7wico2pdlm7p40uyqas3', '7ed33de35ddddfbd733a00fe5fd429366a4011a1ec3c0581dc33d5bf08cba567'),
    (Decimal('17.71259259'), Decimal('239.12'), Decimal('13.5'), '2012-12-24 14:27:50', 'bc1q7sddjwcqjeaxqojndpymmlics79vs8zpnzdiso9sqs4n', '6c9a850550d6a5ad4b0ec8aa940ee0d9edfcae9fdf4e67fa064d21c33fd4f325'),
    (Decimal('9.56518519'), Decimal('129.13'), Decimal('13.5'), '2012-12-24 19:53:05', 'bc1hme9imoqgd9x462pj9h7mpioxlwtsq9sesemrzix70joointenovoym6qoc', '0bcd7a58f6da386d5f12cac986e43ec12254daa71247c2246d0a218c93c9ee86'),
    (Decimal('12.01555556'), Decimal('162.21'), Decimal('13.5'), '2012-12-27 21:44:54', 'bc1wgzzknajpyizjc8p5uvco04paslhsc4puay6vi9rs3', '21d13b374f2dad8991ff72c093419d69fec5b2cb74f815a1149ca8188e02f440'),
    (Decimal('6.80814815'), Decimal('91.91'), Decimal('13.5'), '2012-12-28 22:39:38', 'bc1xhyqjgtg7j8f8lhwhr4c7nlhwjtnae7y6xetn6k', '9e4090a04eb25149191d699af7bc8d7135674e5192b30b2e99c8f08a370c0290'),
    (Decimal('3.86592593'), Decimal('52.19'), Decimal('13.5'), '2013-01-01 12:20:32', 'bc1awd839o30t2fdc3qch3etuvxn2znkxz38ey6u6tmw', 'cdf1bacb4e84af559c66e9a73f42b59f54835a6368a66b35649e5ce91f9e27a7'),
    (Decimal('6.86074074'), Decimal('92.62'), Decimal('13.5'), '2013-01-02 17:54:56', 'bc1doaiekxz4t9irfwxpct9g8zwh2y44nhnmyl662mcy4qrmov0mds', 'bb0702e8834bae9399026dce491877e39b8dd8e816ac37aa2c5c88ee7bcef726'),
    (Decimal('17.84000000'), Decimal('240.84'), Decimal('13.5'), '2013-01-02 18:00:00', 'bc1h8e9ouj9cy0cw7jglz6d6k0xomktvwau5zut0onjwj90oxqysyp', '91d1965eaee233a8d0df6c7ba100ab5b0d66e9cc9a8ae508e291bfc3d17807f9'),
    (Decimal('11.65777778'), Decimal('157.38'), Decimal('13.5'), '2013-01-03 23:42:13', 'bc195fa66ngnmr6untwm6hz55qa729np5x732g7p38', 'b9774296640464b8a6999dc69bbcbf2f2e0b52cbae3532a9aa89d27370000576'),
]

TAGGED_SENDS = [
    (Decimal('1.50000000'), Decimal('20.25'), Decimal('13.5'), '2013-01-03 12:00:00', 'bc1p2x0n2oyvqg0retzsd02mpo60wprgi3ipl0z2yj5yupqd9rzilv4p33zwev', '56f6d7f02bcda4f2a166650b44430fc31402dc1eb71e1a8b26f50039ab37f877'),
    (Decimal('0.50000000'), Decimal('6.75'), Decimal('13.5'), '2013-01-03 12:18:00', 'bc178egp2mmh8od09kyzfewfn0w8vqy7ko99fnm9h6gqz8v', 'bd869911750fced573f1444a49dd7b70024fcda951785e2a5b539187b2d03fa4'),
]

def generate_unique_txid(base_txid, user_id, index):
    unique_str = f'{base_txid}_{user_id}_{index}'
    hash_obj = hashlib.sha256(unique_str.encode())
    return f'tx_{hash_obj.hexdigest()[:24]}'

def generate_unique_address(base_addr, user_id, index):
    if not base_addr or base_addr == '':
        return ''
    unique_str = f'{base_addr}_{user_id}_{index}'
    hash_obj = hashlib.sha256(unique_str.encode())
    prefix = base_addr[:4] if base_addr.startswith('bc1') else 'bc1'
    return f'{prefix}{hash_obj.hexdigest()[:39]}'

def get_base_date():
    return datetime(2012, 12, 17, 0, 0, 0)

def parse_tagged_date(date_str):
    return datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S')
# Connect to DB
conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()

# Get users to process (starting from 682)
cursor.execute('SELECT id FROM users WHERE id >= 682 ORDER BY id')
users = [row[0] for row in cursor.fetchall()]

pairs = [(users[i], users[i+1]) for i in range(0, len(users) - 1, 2)]
print(f'Processing {len(pairs)} pairs...')

base_date = get_base_date()
now = datetime.now()

# Process in batches
batch_size = 50
for batch_idx in range(0, len(pairs), batch_size):
    batch = pairs[batch_idx:batch_idx + batch_size]
    
    # Collect all transactions for this batch
    txns_to_insert = []
    wallet_updates = []
    
    for base_user_id, paired_user_id in batch:
        # ---- BASE USER (even ID): Non-tagged 33.33 BTC pattern ----
        for idx, (amount, fiat_usd, price, day_offset, sec_offset, base_txid) in enumerate(NON_TAGGED_RECEIVES):
            tx_date = base_date + timedelta(days=day_offset, seconds=sec_offset)
            unique_txid = generate_unique_txid(base_txid, base_user_id, idx)
            
            metadata = json.dumps({
                "backfilled": True,
                "source": "management_command_simple",
                "original_usd": float(fiat_usd),
                "btc_price": float(price)
            })
            
            txns_to_insert.append((
                'receive', 'BTC', str(amount), '0', 'completed', unique_txid,
                '', '', '', '0', str(fiat_usd), str(price),
                f'BTC receive - ${fiat_usd}', metadata,
                tx_date.strftime('%Y-%m-%d %H:%M:%S'),
                now.strftime('%Y-%m-%d %H:%M:%S'),
                (tx_date + timedelta(seconds=12)).strftime('%Y-%m-%d %H:%M:%S'),
                None, base_user_id
            ))
        
        wallet_updates.append((str(Decimal('33.33333333')), str(Decimal('33.33333333')), '0', now.strftime('%Y-%m-%d %H:%M:%S'), base_user_id, 'BTC'))
        
        # ---- PAIRED USER (odd ID): Tagged 216 BTC pattern ----
        total_received = Decimal('0')
        for idx, (amount, fiat_usd, price, date_str, from_addr, base_txid) in enumerate(TAGGED_RECEIVES):
            tx_date = parse_tagged_date(date_str)
            unique_txid = generate_unique_txid(base_txid, paired_user_id, idx)
            unique_from = generate_unique_address(from_addr, paired_user_id, idx)
            
            metadata = json.dumps({
                "backfill": True,
                "historical_price_usd": float(price)
            })
            
            txns_to_insert.append((
                'receive', 'BTC', str(amount), '0', 'completed', unique_txid,
                '', unique_from, '', '0', str(fiat_usd), str(price),
                f'Historical receive from {unique_from[:12]}...', metadata,
                tx_date.strftime('%Y-%m-%d %H:%M:%S'),
                now.strftime('%Y-%m-%d %H:%M:%S'),
                tx_date.strftime('%Y-%m-%d %H:%M:%S'),
                None, paired_user_id
            ))
            total_received += amount
        
        for idx, (amount, fiat_usd, price, date_str, to_addr, base_txid) in enumerate(TAGGED_SENDS):
            tx_date = parse_tagged_date(date_str)
            unique_txid = generate_unique_txid(base_txid, paired_user_id, idx + 100)
            unique_to = generate_unique_address(to_addr, paired_user_id, idx)
            
            metadata = json.dumps({
                "backfill": True,
                "historical_price_usd": float(price)
            })
            
            txns_to_insert.append((
                'send', 'BTC', str(amount), '0', 'completed', unique_txid,
                unique_to, '', '', '0', str(fiat_usd), str(price),
                f'Historical send to {unique_to[:12]}...', metadata,
                tx_date.strftime('%Y-%m-%d %H:%M:%S'),
                now.strftime('%Y-%m-%d %H:%M:%S'),
                tx_date.strftime('%Y-%m-%d %H:%M:%S'),
                None, paired_user_id
            ))
        
        total_sent = Decimal('2.0')
        net_balance = total_received - total_sent
        net_balance_q = str(net_balance.quantize(Decimal('0.00000001')))
        wallet_updates.append((net_balance_q, net_balance_q, '0', now.strftime('%Y-%m-%d %H:%M:%S'), paired_user_id, 'BTC'))
    
    # Bulk insert transactions
    cursor.executemany('''
        INSERT INTO users_transaction 
        (transaction_type, asset, amount, fee, status, txid, to_address, from_address,
         destination_asset, destination_amount, fiat_amount, price_at_time, memo, metadata,
         created_at, updated_at, completed_at, counterparty_id, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', txns_to_insert)
    
    # Update wallets
    for qty, avail, locked, updated, user_id, ticker in wallet_updates:
        cursor.execute('''
            INSERT INTO wallet_assets (user_id, ticker, name, quantity, available_quantity, locked_quantity, created_at, updated_at)
            VALUES (?, ?, 'Bitcoin', ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, ticker) DO UPDATE SET
                quantity = excluded.quantity,
                available_quantity = excluded.available_quantity,
                locked_quantity = excluded.locked_quantity,
                updated_at = excluded.updated_at
        ''', (user_id, ticker, qty, avail, locked, now.strftime('%Y-%m-%d %H:%M:%S'), updated))
    
    conn.commit()
    print(f'  Batch {batch_idx//batch_size + 1}: Processed {len(batch)} pairs, {len(txns_to_insert)} transactions')

print('Done!')
conn.close()
