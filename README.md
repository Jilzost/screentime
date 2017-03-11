# screentime

AWS Setup notes:
To get websockets working, courtesy https://mitchellsimoens.com/websockets-behind-elastic-beanstalk/ :
Go to EB dashboard, select environment, clock Configuration, scroll to top, second item should be "Protocol," change from "HTTP" to "TCP." Click save to deploy change.
