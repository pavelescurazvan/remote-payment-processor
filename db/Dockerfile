FROM sqitch/sqitch

COPY db/src ./src
COPY db/sqitch.conf ./
COPY db/sqitch.plan ./

ENTRYPOINT sqitch plan && sqitch deploy
