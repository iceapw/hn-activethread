const { randomUUID } = require('crypto');
const { Kafka } = require('kafkajs');
const { getTopStoryIds, getItem } = require('./hnClient');

const TOPIC = 'social-engagements';
const BROKER = process.env.KAFKA_BROKER || 'localhost:9092';

async function start() {
  const kafka = new Kafka({
    clientId: 'activethread-ingester',
    brokers: [BROKER],
  });

  const admin = kafka.admin();
  const producer = kafka.producer();

  await admin.connect();
  await admin.createTopics({
    topics: [{ topic: TOPIC, numPartitions: 3 }],
  });
  await admin.disconnect();

  await producer.connect();
  console.log('Ingester connected to Kafka');

  const seenStories = new Set();
  const seenComments = new Set();
  let totalSent = 0;
  let lastLogTime = Date.now();

  function stripHtml(str) {
    return (str || '')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&nbsp;/g, ' ')
      .trim()
      .slice(0, 300);
  }

  async function poll() {
    try {
      const storyIds = await getTopStoryIds(10);
      const messages = [];

      for (const storyId of storyIds) {
        const story = await getItem(storyId);
        if (!story || story.dead || story.deleted) continue;

        if (!seenStories.has(storyId)) {
          seenStories.add(storyId);
          messages.push(makeEvent('view', `hn-${storyId}`, null, {
            author: story.by,
            title: story.title,
            storyId,
          }, story.time));
        }

        // Fetch the last 5 comment IDs (kids) for this story
        const kids = (story.kids || []).slice(-5);
        for (const commentId of kids) {
          if (seenComments.has(commentId)) continue;
          seenComments.add(commentId);

          const comment = await getItem(commentId);
          if (!comment || comment.dead || comment.deleted || !comment.text) continue;

          const text = stripHtml(comment.text);
          if (!text) continue;

          messages.push(makeEvent('comment', `hn-${storyId}`, text, {
            author: comment.by,
            title: story.title,
            commentId,
            storyId,
          }, comment.time));
        }
      }

      if (messages.length > 0) {
        await producer.send({ topic: TOPIC, messages });
        totalSent += messages.length;
      }
    } catch (err) {
      console.error('Error polling HN:', err.message);
    }

    const now = Date.now();
    if (now - lastLogTime >= 30000) {
      console.log(`Sent ${totalSent} events in last ${((now - lastLogTime) / 1000).toFixed(0)}s`);
      totalSent = 0;
      lastLogTime = now;
    }
  }

  function cleanup() {
    if (seenStories.size > 5000) {
      const arr = [...seenStories];
      seenStories.clear();
      arr.slice(-2500).forEach((id) => seenStories.add(id));
    }
    if (seenComments.size > 5000) {
      const arr = [...seenComments];
      seenComments.clear();
      arr.slice(-2500).forEach((id) => seenComments.add(id));
    }
  }

  function makeEvent(eventType, contentId, text, meta, createdUtc) {
    const timestamp = createdUtc
      ? new Date(createdUtc * 1000).toISOString()
      : new Date().toISOString();
    return {
      key: contentId,
      value: JSON.stringify({
        eventId: randomUUID(),
        platform: 'hackernews',
        contentId,
        eventType,
        text,
        timestamp,
        metadata: {
          author: meta.author || 'anonymous',
          title: meta.title || null,
          commentId: meta.commentId || null,
          storyId: meta.storyId || null,
        },
      }),
    };
  }

  const pollInterval = setInterval(poll, 30000);
  const cleanupInterval = setInterval(cleanup, 300000);

  await poll();
  console.log('Polling HackerNews top stories for real-time data...');

  const shutdown = async () => {
    console.log('Shutting down ingester...');
    clearInterval(pollInterval);
    clearInterval(cleanupInterval);
    await producer.disconnect();
    console.log('Ingester stopped.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('Ingester error:', err);
  process.exit(1);
});
