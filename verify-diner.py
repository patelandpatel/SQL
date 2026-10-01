"""Independent Python oracle: no reference SQL is used to calculate expected results."""
from collections import Counter,defaultdict
from datetime import date
from pathlib import Path
import json
root=Path(__file__).parent/'datasets/dannys-diner'
fixtures=json.loads((root/'fixtures.json').read_text());actual=json.loads((root/'expected/results.json').read_text())
for fixture,f in fixtures.items():
 sales=f['sales']; menu={pid:(name,price) for pid,name,price in f['menu']};members=dict(f['members']);customers=sorted({s[0] for s in sales})
 amounts=Counter();visits=defaultdict(set);dishcount=Counter();fav=Counter();points=Counter();january=Counter();beforeitems=Counter();beforespent=Counter()
 for c,day,pid in sales:
  name,price=menu[pid];amounts[c]+=price;visits[c].add(day);dishcount[name]+=1;fav[c,name]+=1;points[c]+=price*10*(2 if name=='sushi' else 1)
  if c in members:
   if day<members[c]:beforeitems[c]+=1;beforespent[c]+=price
   if '2021-01-01'<=day<'2021-02-01':
    days=(date.fromisoformat(day)-date.fromisoformat(members[c])).days
    january[c]+=price*10*(2 if 0<=days<=6 or name=='sushi' else 1)
 def earliest(last=False,member=False):
  rows=[]
  for c in customers:
   eligible=[s for s in sales if s[0]==c and (not member or c in members and (s[1]<members[c] if last else s[1]>=members[c]))]
   if not eligible:continue
   target=(max if last else min)(s[1] for s in eligible)
   rows.extend([[c,name] for name in sorted({menu[s[2]][0] for s in eligible if s[1]==target})])
  return rows
 ledger=sorted([[c,day,*menu[pid],'Y' if c in members and day>=members[c] else 'N'] for c,day,pid in sales],key=lambda s:(s[0],s[1],s[2]))
 ranks={}
 for c in customers:
  member_dates=sorted(s[1] for s in ledger if s[0]==c and s[4]=='Y')
  for i,day in enumerate(member_dates):ranks.setdefault((c,day),i+1)
 expected={
  1:[[c,amounts[c]] for c in customers],2:[[c,len(visits[c])] for c in customers],3:earliest(),
  4:[[n,count] for n,count in sorted(dishcount.items()) if count==max(dishcount.values())],
  5:[[c,n,count] for (c,n),count in sorted(fav.items()) if count==max(v for (c2,n2),v in fav.items() if c2==c)],
  6:earliest(member=True),7:earliest(last=True,member=True),8:[[c,beforeitems[c],beforespent[c]] for c in sorted(members)],
  9:[[c,points[c]] for c in customers],10:[[c,january[c]] for c in ['A','B'] if c in members],11:ledger,
  12:[row+[ranks[c,day] if member=='Y' else None] for row in ledger for c,day,name,price,member in [row]]}
 for q,rows in expected.items():
  normalized=[[str(v) if v is not None else None for v in row] for row in rows]
  assert actual[fixture][str(q)]['rows']==normalized,(fixture,q,actual[fixture][str(q)]['rows'],normalized)
 print(f'{fixture}: independently verified all 12 Diner outputs.')
assert actual['sample']['1']['rows']==[['A','76'],['B','74'],['C','36']]
assert actual['sample']['10']['rows']==[['A','1370'],['B','820']]
print('Known spending and January reward totals also verified.')
