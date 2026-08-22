import os
import sys
import logging
from datetime import datetime
from apscheduler.schedulers.blocking import BlockingScheduler

# Setup current working directory in path so python can import local scripts correctly
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

def job_collect_traffic():
    logger.info("Scheduler Trigger: Starting traffic logs collection run...")
    try:
        import collect_traffic
        collect_traffic.run_collection()
        logger.info("Scheduler Trigger: Traffic logs collection run completed.")
    except Exception as e:
        logger.error(f"Scheduler Trigger: Traffic collection job failed: {e}")

def job_collect_weather():
    logger.info("Scheduler Trigger: Starting weather logs collection run...")
    try:
        import collect_weather
        collect_weather.run_collection()
        logger.info("Scheduler Trigger: Weather logs collection run completed.")
    except Exception as e:
        logger.error(f"Scheduler Trigger: Weather collection job failed: {e}")

if __name__ == '__main__':
    logger.info("Initializing background scheduler...")
    
    scheduler = BlockingScheduler()
    
    # Schedule collect_traffic and collect_weather to run immediately and then every 30 minutes
    scheduler.add_job(
        job_collect_traffic,
        'interval',
        minutes=30,
        next_run_time=datetime.now()
    )
    scheduler.add_job(
        job_collect_weather,
        'interval',
        minutes=30,
        next_run_time=datetime.now()
    )
    
    logger.info("Scheduler started. Jobs scheduled every 30 minutes. Press Ctrl+C to stop.")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler execution stopped by user or system request.")
